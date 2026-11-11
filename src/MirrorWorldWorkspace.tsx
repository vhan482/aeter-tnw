import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './mirror-world.css';
import { uploadMirrorEvidence } from './lib/mirror-evidence';
import { MirrorOcrReview } from './MirrorOcrReview';
import { MirrorBossInsights } from './MirrorBossInsights';

type Officer={id:string;role:'GUILD_LEADER'|'OFFICER'|'CLERK'};
type Context={officer:Officer;onExpired:()=>void};
type Boss={id:string;name:string;race:string|null;size:string|null;element:string|null;elementLevel:number|null;version:number};
type Session={id:string;bossId:string;bossName:string;startsAt:string;durationSeconds:number;rotation:string|null};
type Member={id:string;characterName:string};
type Result={
  id:string;memberId:string;characterName:string;rank:number|null;damageRaw:string;
  damageEstimate:string;approximate:boolean;averageDpsEstimate:string;
  sourceReference:string;evidenceUploadId:string|null;version:number;reviewedAt:string;
};
type Detail={session:Session;results:Result[]};
const root='/api/management/mirror-world';
function localDateTime(){
  const now=new Date();
  return new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16);
}
function message(error:unknown){return error instanceof Error?error.message:'Unable to complete the request';}
async function api<T>(path:string,init:RequestInit={},onExpired?:()=>void):Promise<T>{
  const res=await fetch(path,{credentials:'same-origin',cache:'no-store',...init,
    headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}});
  if(res.status===401)onExpired?.();
  if(!res.ok){const body=await res.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error||`Request failed (${res.status})`);}
  return res.status===204?undefined as T:res.json() as Promise<T>;
}
const empty={memberId:'',rank:'',damageRaw:'',sourceReference:'',reviewed:false,reason:''};
function formatDamage(value:string){try{return BigInt(value).toLocaleString('en-US');}catch{return value;}}
function dateLabel(instant:string){return new Date(instant).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});}

export function MirrorWorldView({officer,onExpired}:Context){
  const [bosses,setBosses]=useState<Boss[]>([]);
  const [sessions,setSessions]=useState<Session[]>([]);
  const [members,setMembers]=useState<Member[]>([]);
  const [selected,setSelected]=useState('');
  const [detail,setDetail]=useState<Detail|null>(null);
  const [bossName,setBossName]=useState('');
  const [bossId,setBossId]=useState('');
  const [date,setDate]=useState(localDateTime);
  const [duration,setDuration]=useState('900');
  const [rotation,setRotation]=useState('');
  const [form,setForm]=useState(empty);
  const [screenshot,setScreenshot]=useState<File|null>(null);
  const [editing,setEditing]=useState<Result|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [refreshCounter,setRefreshCounter]=useState(0);

  const refresh=useCallback(async()=>{
    const [b,s,m]=await Promise.all([
      api<{bosses:Boss[]}>(root+'/bosses',{},onExpired),
      api<{sessions:Session[]}>(root+'/sessions',{},onExpired),
      api<{members:Member[]}>('/api/management/members?limit=250',{},onExpired)
    ]);
    setBosses(b.bosses);setSessions(s.sessions);setMembers(m.members);
    setBossId(old=>old||b.bosses[0]?.id||'');
    setSelected(old=>old||s.sessions[0]?.id||'');
  },[onExpired]);
  const refreshDetail=useCallback(async(id:string)=>{
    const data=await api<Detail>(root+'/sessions/'+id,{},onExpired);
    setDetail(data);
    setRefreshCounter(old=>old+1);
  },[onExpired]);
  useEffect(()=>{void refresh().catch(e=>setError(message(e)));},[refresh]);
  useEffect(()=>{
    if(!selected){setDetail(null);return;}
    void refreshDetail(selected).catch(e=>setError(message(e)));
  },[selected,refreshDetail]);

  async function execute(action:()=>Promise<void>){
    setBusy(true);setError('');setNotice('');
    try{await action();}catch(e){setError(message(e));}
    finally{setBusy(false);}
  }
  function addBoss(e:FormEvent){e.preventDefault();void execute(async()=>{
    const data=await api<{boss:Boss}>(root+'/bosses',{
      method:'POST',body:JSON.stringify({name:bossName,race:null,size:null,element:null,elementLevel:null})
    },onExpired);
    await refresh();setBossId(data.boss.id);setBossName('');
    setNotice('Boss added. Its race, size and element are unknown until verified.');
  });}
  function addSession(e:FormEvent){e.preventDefault();void execute(async()=>{
    if(!bossId)throw new Error('Choose an existing boss first');
    const dateObj=new Date(date);
    if(Number.isNaN(dateObj.getTime()))throw new Error('Select a valid event time');
    const data=await api<{session:Session}>(root+'/sessions',{
      method:'POST',body:JSON.stringify({
        bossId,startsAt:dateObj.toISOString(),durationSeconds:Number(duration),
        rotation:rotation.trim()||null
      })
    },onExpired);
    await refresh();setSelected(data.session.id);setRotation('');
    setNotice('Mirror World session created. Review individual results before saving.');
  });}
  function editResult(r:Result){
    setEditing(r);setScreenshot(null);
    setForm({memberId:r.memberId,rank:r.rank===null?'':String(r.rank),
      damageRaw:r.damageRaw,sourceReference:r.sourceReference,reviewed:false,reason:''});
    setError('');setNotice('');
  }
  function resetResult(){setEditing(null);setForm(empty);setScreenshot(null);}
  function saveResult(e:FormEvent){e.preventDefault();if(!selected)return;void execute(async()=>{
    if(!form.reviewed)throw new Error('You must personally review the source before saving');
    if(!form.memberId)throw new Error('Match the result to an actual member');
    if(editing&&screenshot)throw new Error('For an audited correction, retain the linked screenshot and update the reference');
    const image=screenshot?await uploadMirrorEvidence(screenshot,onExpired):null;
    const body={
      memberId:form.memberId,rank:form.rank.trim()?Number(form.rank):null,
      damageRaw:form.damageRaw,sourceReference:(image?.originalName||form.sourceReference).trim(),
      evidenceUploadId:image?.id??editing?.evidenceUploadId??null,reviewed:true
    };
    if(editing){
      await api(root+'/sessions/'+selected+'/results/'+editing.id,{
        method:'PATCH',body:JSON.stringify({...body,version:editing.version,reason:form.reason})
      },onExpired);
    }else{
      await api(root+'/sessions/'+selected+'/results',{
        method:'POST',body:JSON.stringify(body)
      },onExpired);
    }
    await refreshDetail(selected);resetResult();
    setNotice(image?'Reviewed result saved with private screenshot. Image bytes expire after 7 days.':
      'Reviewed result saved in PostgreSQL.');
  });}

  return <div className="mirror-world">
    <header className="phase-header"><span className="roster-eyebrow">GUILD COMMAND CENTER / PERFORMANCE</span>
      <h1>Mirror World</h1>
      <p>Boss sessions, accumulated damage and approximate average DPS — based on reviewed screenshots.</p>
    </header>
    {error&&<p className="phase-error" role="alert">{error}</p>}
    {notice&&<p className="phase-success" role="status">{notice}</p>}
    <div className="mirror-layout">
      <section className="roster-card">
        <h2>Boss catalog</h2>
        <p className="roster-note">Create a boss once. Unknown race, size and element stay unassigned.</p>
        {officer.role!=='CLERK'&&<form className="mirror-form" onSubmit={addBoss}>
          <label>Boss name<input value={bossName} maxLength={100} required
            onChange={e=>setBossName(e.target.value)} placeholder="Enter verified boss name"/></label>
          <button className="roster-primary" disabled={busy}>Add boss</button>
        </form>}
        <h2>New session</h2>
        <form className="mirror-form" onSubmit={addSession}>
          <label>Boss<select required value={bossId} onChange={e=>setBossId(e.target.value)}>
            <option value="">Select boss</option>
            {bosses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
          <label>Event date & time<input type="datetime-local" required value={date}
            onChange={e=>setDate(e.target.value)}/></label>
          <label>Duration (seconds)<input type="number" min={60} max={7200} step={1}
            value={duration} onChange={e=>setDuration(e.target.value)}/></label>
          <label>Rotation (optional)<input maxLength={80} value={rotation}
            onChange={e=>setRotation(e.target.value)}/></label>
          <button className="roster-primary" disabled={busy||!bossId}>Create session</button>
        </form>
      </section>
      <section className="roster-card">
        <h2>Sessions</h2>
        {!sessions.length&&<p className="roster-note">No Mirror World sessions recorded yet.</p>}
        <div className="mirror-sessions">{sessions.map(s=><button key={s.id} type="button"
          className={selected===s.id?'mirror-active':''} onClick={()=>{setSelected(s.id);resetResult();}}>
          <strong>{s.bossName}</strong><span>{dateLabel(s.startsAt)} · {s.durationSeconds}s</span>
        </button>)}</div>
        {detail&&<div className="mirror-session-summary">
          <h3>{detail.session.bossName}</h3>
          <p>{dateLabel(detail.session.startsAt)} · {detail.session.durationSeconds}s · {detail.results.length} reviewed rows</p>
          <small>Average DPS is a duration-based estimate, not the game's raw DPS value.</small>
        </div>}
      </section>
    </div>
    <MirrorBossInsights bosses={bosses} members={members}
      activeBossId={detail?.session.bossId??bossId} role={officer.role}
      refreshCounter={refreshCounter} onExpired={onExpired}
      onBossUpdated={async()=>{await refresh();if(selected)await refreshDetail(selected);}} />
    {detail&&<MirrorOcrReview sessionId={selected} existing={detail.results}
      onExpired={onExpired} onSaved={()=>refreshDetail(selected)} />}
    {detail&&<div className="mirror-layout">
      <section className="roster-card">
        <h2>{editing?'Correct reviewed result':'Record player result'}</h2>
        <p className="roster-note">Use manual entry or the screenshot reader above. Verify every value against the original image before saving.</p>
        <form className="mirror-form" onSubmit={saveResult}>
          <label>Member<select required value={form.memberId}
            onChange={e=>setForm({...form,memberId:e.target.value})}>
            <option value="">Match a guild member</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.characterName}</option>)}
          </select></label>
          <label>Visible rank (optional)<input type="number" min={1} max={500}
            value={form.rank} onChange={e=>setForm({...form,rank:e.target.value})}/>
          </label>
          <label>Total damage as displayed<input required maxLength={32}
            placeholder="18.8B" value={form.damageRaw}
            onChange={e=>setForm({...form,damageRaw:e.target.value})}/></label>
          <label>Screenshot/source reference<input required={!screenshot} maxLength={255}
            placeholder="mirror-ranking-page1.png" value={form.sourceReference}
            onChange={e=>setForm({...form,sourceReference:e.target.value})}/></label>
          {!editing&&<label>Private screenshot (optional, expires after 7 days)
            <input type="file" accept="image/png,image/jpeg,image/webp"
              onChange={e=>setScreenshot(e.target.files?.[0]??null)}/></label>}
          {editing&&<label>Correction reason<textarea required minLength={5} maxLength={1000}
            value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}
            placeholder="Explain what changed in the source review"/></label>}
          <label className="mirror-review"><input type="checkbox" checked={form.reviewed}
            onChange={e=>setForm({...form,reviewed:e.target.checked})}/>
            I checked the member, rank and total damage against the source screenshot</label>
          <div className="mirror-actions">
            <button className="roster-primary" disabled={busy||!form.reviewed}>
              {busy?'Saving…':editing?'Save audited correction':'Save reviewed result'}</button>
            {editing&&<button type="button" onClick={resetResult}>Cancel</button>}
          </div>
        </form>
      </section>
      <section className="roster-card">
        <h2>Reviewed leaderboard</h2>
        {!detail.results.length&&<p className="roster-note">No reviewed results yet. Missing ranks are not zero scores.</p>}
        <div className="mirror-results">
          {detail.results.map(r=><div key={r.id} className="mirror-result">
            <div><strong>{r.rank===null?'—':`#${r.rank}`} · {r.characterName}</strong>
              <small>{r.sourceReference} · version {r.version}</small>
              <small>{r.approximate?'Approximate rounded screenshot total':'Displayed total'}</small></div>
            <div className="mirror-numbers">
              <strong>{r.damageRaw}</strong><span>≈ {formatDamage(r.damageEstimate)} damage</span>
              <span>≈ {r.averageDpsEstimate} average DPS</span>
              {r.evidenceUploadId&&<a target="_blank" rel="noopener noreferrer"
                href={'/api/management/attendance/evidence/'+r.evidenceUploadId+'/file'}>
                View private screenshot (7-day window)</a>}
              <button type="button" onClick={()=>editResult(r)}>Correct</button>
            </div>
          </div>)}
        </div>
      </section>
    </div>}
  </div>;
}
