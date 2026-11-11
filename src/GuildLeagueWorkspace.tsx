import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { uploadMirrorEvidence } from './lib/mirror-evidence';
import { leagueFieldSets } from './lib/league-ocr';
import { LeagueOcrReview } from './LeagueOcrReview';
import './guild-league.css';

type Battlefield='MAIN'|'SUB';
type Tab='DPS'|'SUPPORT'|'STRATEGY';
type MetricValue=string|number|null;
type Member={id:string;characterName:string};
type Match={id:string;opponentGuild:string;occurredAt:string;stage:string|null;result:string|null};
type Observation={
  id:string;memberId:string;characterName:string;
  battlefield:Battlefield;tab:Tab;metrics:Record<string,MetricValue>;
  sourceReference:string;evidenceUploadId:string|null;version:number
};
type Player={memberId:string;characterName:string;battlefield:Battlefield;
  dps:Observation|null;support:Observation|null;strategy:Observation|null;
};
type Detail={match:Match;observations:Observation[];players:Player[];note:string};
const fieldSets=leagueFieldSets;
const apiRoot='/api/management/league';
const blankMetrics=()=>({kills:'',assists:'',playerDamageRaw:'',buildingDamageRaw:'',
  deaths:'',revives:'',healingRaw:'',damageTakenRaw:'',
  minionMetricRaw:'',flagRepairs:'',bossFinishers:'',bossDamageRaw:''});
function localDateTime(){
  const now=new Date();return new Date(now.getTime()-now.getTimezoneOffset()*60000)
    .toISOString().slice(0,16);
}
function msg(e:unknown){return e instanceof Error?e.message:'Request failed';}
function when(instant:string){
  return new Date(instant).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
}
function display(v:MetricValue|undefined):string{
  return v===null||v===undefined?'—':String(v);
}
async function api<T>(path:string,init:RequestInit={},onExpired?:()=>void):Promise<T>{
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...init,
    headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
  if(res.status===401)onExpired?.();
  if(!res.ok){
    const body=await res.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error||`Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}
export function GuildLeagueView({onExpired}:{onExpired:()=>void}){
  const [matches,setMatches]=useState<Match[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [selected,setSelected]=useState('');
  const [detail,setDetail]=useState<Detail|null>(null);
  const [opponent,setOpponent]=useState('');
  const [eventDate,setEventDate]=useState(localDateTime);
  const [stage,setStage]=useState('');
  const [result,setResult]=useState('');
  const [battlefield,setBattlefield]=useState<Battlefield>('MAIN');
  const [tab,setTab]=useState<Tab>('DPS');
  const [memberId,setMemberId]=useState('');
  const [metrics,setMetrics]=useState<Record<string,string>>(blankMetrics);
  const [sourceReference,setSourceReference]=useState('');
  const [file,setFile]=useState<File|null>(null);
  const [reviewed,setReviewed]=useState(false);
  const [editing,setEditing]=useState<Observation|null>(null);
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  const refresh=useCallback(async()=>{
    const [m,r]=await Promise.all([
      api<{matches:Match[]}>(apiRoot+'/matches',{},onExpired),
      api<{members:Member[]}>('/api/management/members?limit=250',{},onExpired)
    ]);
    setMatches(m.matches);setMembers(r.members);
    setSelected(old=>old||m.matches[0]?.id||'');
  },[onExpired]);
  const refreshDetail=useCallback(async(id:string)=>{
    const response=await api<Detail>(apiRoot+'/matches/'+id,{},onExpired);
    setDetail(response);
  },[onExpired]);
  useEffect(()=>{void refresh().catch(e=>setError(msg(e)));},[refresh]);
  useEffect(()=>{
    if(!selected){setDetail(null);return;}
    void refreshDetail(selected).catch(e=>{setDetail(null);setError(msg(e));});
  },[selected,refreshDetail]);

  function resetForm(){
    setEditing(null);setMemberId('');setMetrics(blankMetrics());setSourceReference('');
    setFile(null);setReviewed(false);setReason('');
  }
  function changeBattlefield(value:Battlefield){
    setBattlefield(value);if(value==='MAIN'&&tab==='STRATEGY')setTab('DPS');
    setReviewed(false);
  }
  function editRow(row:Observation){
    setEditing(row);setBattlefield(row.battlefield);setTab(row.tab);setMemberId(row.memberId);
    setMetrics(Object.fromEntries(Object.entries(blankMetrics()).map(([key])=>
      [key,row.metrics[key]===null||row.metrics[key]===undefined?'':String(row.metrics[key])])));
    setSourceReference(row.sourceReference);setFile(null);setReviewed(false);setReason('');
    setNotice('');setError('');
  }
  async function submitMatch(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setNotice('');
    try{
      const date=new Date(eventDate);
      if(!Number.isFinite(date.getTime()))throw new Error('Select a valid match time');
      const data=await api<{match:Match}>(apiRoot+'/matches',{
        method:'POST',body:JSON.stringify({
          opponentGuild:opponent.trim(),occurredAt:date.toISOString(),
          stage:stage||null,result:result||null
        })
      },onExpired);
      await refresh();setSelected(data.match.id);
      setOpponent('');setNotice('Match created. Record only guild members visible on reviewed tabs.');
      resetForm();
    }catch(err){setError(msg(err));}finally{setBusy(false);}
  }
  async function saveObservation(e:FormEvent){
    e.preventDefault();if(!selected)return;
    setBusy(true);setError('');setNotice('');
    try{
      if(!reviewed)throw new Error('Confirm each visible value against the screenshot');
      if(!memberId)throw new Error('Select the verified guild member');
      const data:Record<string,MetricValue>={};
      for(const field of fieldSets[tab]){
        const text=metrics[field.key]?.trim()??'';
        data[field.key]=text===''?null:field.kind==='count'?Number(text):text;
        if(field.kind==='count'&&text!==''&&
          (!Number.isSafeInteger(Number(data[field.key]))||Number(data[field.key])<0||Number(data[field.key])>2_000_000_000))
          throw new Error('Counts must be nonnegative integers');
      }
      if(!Object.values(data).some(x=>x!==null))throw new Error('Record at least one visible metric');
      const evidence=file?await uploadMirrorEvidence(file,onExpired):null;
      const value={
        memberId,battlefield,tab,metrics:data,sourceReference:
          (sourceReference.trim()||evidence?.originalName||'').slice(0,255),
        evidenceUploadId:evidence?.id??editing?.evidenceUploadId??null,reviewed:true
      };
      if(!value.sourceReference)throw new Error('Specify a screenshot reference or select an image');
      if(editing){
        await api(apiRoot+'/matches/'+selected+'/tab-results/'+editing.id,{
          method:'PATCH',body:JSON.stringify({value,version:editing.version,reason:reason.trim()})
        },onExpired);
      }else{
        await api(apiRoot+'/matches/'+selected+'/tab-results',{
          method:'POST',body:JSON.stringify(value)
        },onExpired);
      }
      await refreshDetail(selected);
      resetForm();setNotice('Reviewed Guild League tab result saved. Missing fields remain unknown.');
    }catch(err){setError(msg(err));}finally{setBusy(false);}
  }
  const existing=useMemo(()=>new Set(
    detail?.observations.map(row=>row.battlefield+':'+row.tab+':'+row.memberId)??[]
  ),[detail]);
  const duplicate=!editing&&existing.has(battlefield+':'+tab+':'+memberId);

  return <div className="guild-league">
    <header className="phase-header">
      <span className="roster-eyebrow">GUILD COMMAND CENTER / PERFORMANCE</span>
      <h1>Guild League</h1>
      <p>Record Main and Sub battlefield screenshots. DPS, Support and Strategy tabs combine by guild member identity—not row order.</p>
    </header>
    {error&&<p className="phase-error" role="alert">{error}</p>}
    {notice&&<p className="phase-success" role="status">{notice}</p>}
    <div className="league-layout">
      <section className="roster-card">
        <h2>Create match</h2>
        <form className="league-form" onSubmit={e=>void submitMatch(e)}>
          <label>Opponent guild<input required maxLength={128} value={opponent}
            onChange={e=>setOpponent(e.target.value)}/></label>
          <label>Match date and time<input type="datetime-local" value={eventDate} required
            onChange={e=>setEventDate(e.target.value)}/></label>
          <label>Stage<select value={stage} onChange={e=>setStage(e.target.value)}>
            <option value="">Not specified</option><option value="PRELIMINARY">Preliminary</option>
            <option value="SEMIFINAL">Semifinal</option><option value="FINAL">Final</option>
            <option value="OTHER">Other</option>
          </select></label>
          <label>Result<select value={result} onChange={e=>setResult(e.target.value)}>
            <option value="">Not verified</option><option value="WIN">Win</option>
            <option value="LOSS">Loss</option><option value="DRAW">Draw</option>
          </select></label>
          <button className="roster-primary" disabled={busy}>Create match</button>
        </form>
      </section>
      <section className="roster-card">
        <h2>Recorded matches</h2>
        {!matches.length&&<p className="roster-note">No matches recorded yet.</p>}
        <div className="league-matches">{matches.map(match=><button type="button"
          key={match.id} className={selected===match.id?'league-selected':''}
          onClick={()=>{setSelected(match.id);resetForm();}}>
          <strong>vs {match.opponentGuild}</strong>
          <small>{when(match.occurredAt)} · {match.stage||'Stage unknown'} · {match.result||'Result unknown'}</small>
        </button>)}</div>
        {detail&&<p className="roster-note">Selected match: {detail.match.opponentGuild}. Only our guild's verified player rows are supported in this first release.</p>}
      </section>
    </div>
    {detail&&<LeagueOcrReview key={selected} matchId={selected}
      existing={detail.observations} onExpired={onExpired}
      onSaved={()=>refreshDetail(selected)}/>}
    {detail&&<div className="league-layout">
      <section className="roster-card">
        <h2>{editing?'Correct reviewed tab':'Record screenshot-tab result'}</h2>
        <p className="roster-note">Manual capture or screenshot batch review above. League OCR is not yet calibrated against real game screenshots. Empty values stay unknown; enter 0 only if confirmed in game.</p>
        <form className="league-form" onSubmit={e=>void saveObservation(e)}>
          <label>Battlefield<select disabled={!!editing} value={battlefield}
            onChange={e=>changeBattlefield(e.target.value as Battlefield)}>
            <option value="MAIN">Main</option><option value="SUB">Sub</option>
          </select></label>
          <label>Screenshot tab<select disabled={!!editing} value={tab}
            onChange={e=>{setTab(e.target.value as Tab);setMetrics(blankMetrics());setReviewed(false);}}>
            <option value="DPS">DPS tab (totals)</option><option value="SUPPORT">Support</option>
            {battlefield==='SUB'&&<option value="STRATEGY">Strategy</option>}
          </select></label>
          <label>Guild player<select required disabled={!!editing} value={memberId}
            onChange={e=>{setMemberId(e.target.value);setReviewed(false);}}>
            <option value="">Select member</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.characterName}</option>)}
          </select></label>
          {fieldSets[tab].map(field=><label key={field.key}>{field.label}
            <input value={metrics[field.key]??''} maxLength={32}
              type={field.kind==='count'?'number':'text'} min={field.kind==='count'?0:undefined}
              step={field.kind==='count'?1:undefined}
              placeholder={field.kind==='count'?'Blank = unknown':'e.g. 18.8B; blank = unknown'}
              onChange={e=>{setMetrics(old=>({...old,[field.key]:e.target.value}));setReviewed(false);}}/>
          </label>)}
          <label>Screenshot reference<input required={!file} value={sourceReference} maxLength={255}
            onChange={e=>{setSourceReference(e.target.value);setReviewed(false);}}
            placeholder="league-main-support-1.png"/></label>
          <label>Private screenshot (optional, 7-day retention)
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e=>{setFile(e.target.files?.[0]??null);setReviewed(false);}}/>
          </label>
          {editing&&<label>Correction reason<textarea required minLength={5} maxLength={1000}
            value={reason} onChange={e=>setReason(e.target.value)}/></label>}
          {duplicate&&<p className="phase-error">This member already has a reviewed row for this battlefield and tab. Select Correct on that entry instead.</p>}
          <label className="league-confirm"><input type="checkbox" checked={reviewed}
            onChange={e=>setReviewed(e.target.checked)}/>
            I verified this member, battlefield, screenshot tab and each entered metric against source evidence.
          </label>
          <div className="league-form-actions">
            <button className="roster-primary" disabled={busy||!reviewed||duplicate}>
              {busy?'Saving…':editing?'Save audited correction':'Save reviewed tab result'}</button>
            {editing&&<button type="button" onClick={resetForm}>Cancel correction</button>}
          </div>
        </form>
      </section>
      <section className="roster-card">
        <h2>Reviewed player tabs</h2>
        {!detail.observations.length&&<p className="roster-note">No player observations yet. Unseen screenshots do not prove a player was absent.</p>}
        <div className="league-observation-list">{detail.observations.map(obs=><div
          key={obs.id} className="league-observation">
          <strong>{obs.characterName} · {obs.battlefield} / {obs.tab}</strong>
          <small>{obs.sourceReference} · version {obs.version}</small>
          <div>{fieldSets[obs.tab].map(field=><span key={field.key}>
            {field.label}: <strong>{display(obs.metrics[field.key])}</strong>
          </span>)}</div>
          {obs.evidenceUploadId&&<a target="_blank" rel="noopener noreferrer"
            href={'/api/management/attendance/evidence/'+obs.evidenceUploadId+'/file'}>
            View private screenshot (until expiry)</a>}
          <button type="button" onClick={()=>editRow(obs)}>Correct</button>
        </div>)}</div>
      </section>
    </div>}
    {detail&&<section className="roster-card">
      <h2>Consolidated Guild League results</h2>
      <p className="roster-note">A single member may appear in both battlefields. Tabs merge by identity, and values without a verified screenshot remain unknown. Player and building damage are cumulative totals, NOT DPS.</p>
      {(['MAIN','SUB'] as Battlefield[]).map(field=><div key={field}>
        <h3>{field==='MAIN'?'Main battlefield':'Sub battlefield'}</h3>
        <div className="league-merged-table"><table>
          <thead><tr><th>Member</th><th>Tab coverage</th><th>K</th><th>A</th><th>D</th>
            <th>Player damage total</th><th>Building damage</th><th>Healing</th><th>Revives</th>
            {field==='SUB'&&<th>Flag repairs</th>}</tr></thead>
          <tbody>{detail.players.filter(row=>row.battlefield===field).map(player=><tr key={player.memberId}>
            <td>{player.characterName}</td>
            <td>{['DPS','SUPPORT',...(field==='SUB'?['STRATEGY']:[])]
              .map(tabName=>(player[tabName.toLowerCase() as 'dps'|'support'|'strategy']?'✓':'—')+' '+tabName).join(' · ')}</td>
            <td>{display(player.dps?.metrics.kills)}</td>
            <td>{display(player.dps?.metrics.assists)}</td>
            <td>{display(player.support?.metrics.deaths)}</td>
            <td>{display(player.dps?.metrics.playerDamageRaw)}</td>
            <td>{display(player.dps?.metrics.buildingDamageRaw)}</td>
            <td>{display(player.support?.metrics.healingRaw)}</td>
            <td>{display(player.support?.metrics.revives)}</td>
            {field==='SUB'&&<td>{display(player.strategy?.metrics.flagRepairs)}</td>}
          </tr>)}</tbody>
        </table></div>
        {!detail.players.some(row=>row.battlefield===field)&&
          <p className="roster-note">No reviewed player rows for this battlefield.</p>}
      </div>)}
      <p className="roster-note">Opponent-side player identities, team-level objectives and automated Guild League OCR are future reviewed increments.</p>
    </section>}
  </div>;
}
