import { useEffect, useState, type FormEvent } from 'react';

type Boss={
  id:string;name:string;race:string|null;size:string|null;element:string|null;
  elementLevel:number|null;version:number
};
type Member={id:string;characterName:string};
type TrendRow={
  sessionId:string;startsAt:string;durationSeconds:number;rank:number|null;
  damageRaw:string;damageEstimate:string;approximate:boolean;sourceReference:string;
  averageDpsEstimate:string;changeFromPreviousPercent:string|null;
  bestAmongDisplayed:boolean
};
type Insights={
  boss:{id:string;name:string};member:{id:string;name:string};
  rows:TrendRow[];hasMore:boolean;note:string
};
type Audit={
  id:string;reason:string;changedAt:string;
  before:{name:string;version:number};after:{name:string;version:number}
};
type Props={
  bosses:Boss[];members:Member[];activeBossId:string;
  role:'GUILD_LEADER'|'OFFICER'|'CLERK';
  refreshCounter:number;onBossUpdated:()=>Promise<void>;onExpired:()=>void
};
const base='/api/management/mirror-world';
const emptyFields={name:'',race:'',size:'',element:'',elementLevel:'',reason:''};
function displayWhen(instant:string){
  return new Date(instant).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});
}
function displayBigDecimal(value:string){
  try{
    const [whole,fraction]=value.split('.');
    return BigInt(whole).toLocaleString('en-US')+(fraction?'.'+fraction:'');
  }catch{return value;}
}
async function api<T>(path:string,init:RequestInit={},onExpired?:()=>void):Promise<T>{
  const response=await fetch(path,{
    credentials:'same-origin',cache:'no-store',...init,
    headers:{...(init.body?{'Content-Type':'application/json'}:{}),...init.headers}
  });
  if(response.status===401)onExpired?.();
  if(!response.ok){
    const data=await response.json().catch(()=>({})) as {error?:string};
    throw new Error(data.error||`Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}
function message(e:unknown){return e instanceof Error?e.message:'Request could not be completed';}
function nullable(value:string){return value.trim()||null;}

export function MirrorBossInsights({
  bosses,members,activeBossId,role,refreshCounter,onBossUpdated,onExpired
}:Props){
  const [bossId,setBossId]=useState('');
  const [memberId,setMemberId]=useState('');
  const [fields,setFields]=useState(emptyFields);
  const [insights,setInsights]=useState<Insights|null>(null);
  const [history,setHistory]=useState<Audit[]|null>(null);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{if(activeBossId)setBossId(activeBossId);},[activeBossId]);

  const boss=bosses.find(b=>b.id===bossId)||null;
  useEffect(()=>{
    setFields(boss?{
      name:boss.name,race:boss.race||'',size:boss.size||'',
      element:boss.element||'',elementLevel:boss.elementLevel===null?'':String(boss.elementLevel),
      reason:''
    }:emptyFields);
    setHistory(null);
  },[boss?.id,boss?.version]);

  useEffect(()=>{
    let alive=true;
    if(!bossId||!memberId){setInsights(null);return;}
    setLoading(true);setError('');
    void api<Insights>(
      `${base}/insights?bossId=${encodeURIComponent(bossId)}&memberId=${encodeURIComponent(memberId)}&limit=40`,
      {},onExpired
    ).then(data=>{if(alive)setInsights(data);})
      .catch(e=>{if(alive){setInsights(null);setError(message(e));}})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[bossId,memberId,refreshCounter,onExpired]);

  function submitBoss(e:FormEvent){e.preventDefault();if(!boss||role==='CLERK')return;
    setSaving(true);setError('');setNotice('');
    const level=fields.elementLevel.trim()===''?null:Number(fields.elementLevel);
    if(level!==null&&(!Number.isInteger(level)||level<1||level>10)){
      setError('Element level must be a whole number between 1 and 10');
      setSaving(false);return;
    }
    void api<{boss:Boss}>(`${base}/bosses/${boss.id}`,{
      method:'PATCH',body:JSON.stringify({
        name:fields.name.trim(),race:nullable(fields.race),size:nullable(fields.size),
        element:nullable(fields.element),elementLevel:level,
        reason:fields.reason.trim(),version:boss.version
      })
    },onExpired)
      .then(async()=>{await onBossUpdated();setNotice('Boss metadata updated with an audit record.');})
      .catch(e=>setError(message(e)))
      .finally(()=>setSaving(false));
  }
  async function loadHistory(){
    if(!boss)return;
    setError('');
    try{
      const data=await api<{changes:Audit[]}>(`${base}/bosses/${boss.id}/history`,{},onExpired);
      setHistory(data.changes);
    }catch(e){setError(message(e));}
  }

  return <section className="roster-card mirror-insights">
    <div className="mirror-insights-head">
      <div><h2>Boss context & personal progression</h2>
        <p className="roster-note">Compare only the same player against the same boss. All metrics use reviewed screenshots and estimated full-session average DPS.</p></div>
    </div>
    {error&&<p className="phase-error" role="alert">{error}</p>}
    {notice&&<p className="phase-success" role="status">{notice}</p>}
    <div className="mirror-insights-grid">
      <div>
        <label className="mirror-insights-field">Boss
          <select value={bossId} onChange={e=>setBossId(e.target.value)}>
            <option value="">Select boss</option>
            {bosses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
          </select></label>
        {boss&&<div className="mirror-boss-facts">
          <strong>{boss.name}</strong>
          <span>Race: {boss.race||'Unknown'} · Size: {boss.size||'Unknown'}</span>
          <span>Element: {boss.element||'Unknown'} · Level: {boss.elementLevel??'Unknown'}</span>
        </div>}
        {boss&&role!=='CLERK'&&<form className="mirror-insights-editor" onSubmit={submitBoss}>
          <h3>Correct boss information</h3>
          <label>Boss name<input required maxLength={100} value={fields.name}
            onChange={e=>setFields({...fields,name:e.target.value})}/></label>
          <label>Race<input maxLength={50} value={fields.race}
            onChange={e=>setFields({...fields,race:e.target.value})}/></label>
          <label>Size<input maxLength={50} value={fields.size}
            onChange={e=>setFields({...fields,size:e.target.value})}/></label>
          <label>Element<input maxLength={50} value={fields.element}
            onChange={e=>setFields({...fields,element:e.target.value})}/></label>
          <label>Element level (unknown allowed)<input type="number" min={1} max={10}
            value={fields.elementLevel}
            onChange={e=>setFields({...fields,elementLevel:e.target.value})}/></label>
          <label>Correction reason<textarea minLength={5} maxLength={1000} required
            placeholder="Explain what you verified in game or in a source"
            value={fields.reason} onChange={e=>setFields({...fields,reason:e.target.value})}/></label>
          <button className="roster-primary" disabled={saving}>
            {saving?'Saving…':'Save audited boss correction'}</button>
        </form>}
        {boss&&<div className="mirror-boss-history">
          <button type="button" onClick={()=>void loadHistory()}>View boss changes</button>
          {history&&(!history.length?<p className="roster-note">No corrections yet.</p>:
            <ol>{history.map(entry=><li key={entry.id}>
              <strong>{displayWhen(entry.changedAt)}</strong> — {entry.reason}
              <small>Version {entry.before.version} → {entry.after.version}</small>
            </li>)}</ol>)}
        </div>}
      </div>
      <div>
        <label className="mirror-insights-field">Guild member
          <select value={memberId} onChange={e=>setMemberId(e.target.value)}>
            <option value="">Select a member to compare</option>
            {members.map(m=><option key={m.id} value={m.id}>{m.characterName}</option>)}
          </select>
        </label>
        {!memberId&&<p className="roster-note">Select a member to see their verified Mirror World performance history for this boss.</p>}
        {loading&&<p role="status">Loading reviewed sessions…</p>}
        {!loading&&insights&&<>
          <p className="roster-note">Showing the latest {insights.rows.length} recorded results for {insights.member.name}. Best is within this displayed window, not necessarily an all-time record.</p>
          {!insights.rows.length&&<p>No reviewed records for this player and boss. No participation is inferred.</p>}
          {!!insights.rows.length&&<div className="mirror-insights-table"><table>
            <thead><tr><th>Session</th><th>Damage</th><th>Avg DPS ≈</th><th>Δ previous</th></tr></thead>
            <tbody>{insights.rows.map(row=><tr key={row.sessionId}>
              <td>{displayWhen(row.startsAt)}<small>{row.durationSeconds}s · rank {row.rank??'unknown'}</small></td>
              <td>{row.damageRaw}<small>{row.approximate?'Rounded estimate':'Displayed total'}</small></td>
              <td>{displayBigDecimal(row.averageDpsEstimate)}
                {row.bestAmongDisplayed&&<small className="mirror-best">Best shown</small>}</td>
              <td>{row.changeFromPreviousPercent===null?'—':row.changeFromPreviousPercent+'%'}</td>
            </tr>)}</tbody>
          </table></div>}
          {insights.hasMore&&<p className="roster-note">Older sessions exist but are excluded from this 40-result comparison window.</p>}
          <p className="roster-note">A larger estimated DPS may reflect buffs, duration, boss conditions or builds. Missing rows are unknown—not zero. GR-relative comparisons remain pending verified weekly baseline rules.</p>
        </>}
      </div>
    </div>
  </section>;
}
