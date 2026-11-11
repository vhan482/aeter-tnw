import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './roster-workspace.css';
import { AttendanceView, ActionCenterView } from './Phase3Workspace';
import { MirrorWorldView } from './MirrorWorldWorkspace';
import { GuildLeagueView } from './GuildLeagueWorkspace';

type Role = 'GUILD_LEADER' | 'OFFICER' | 'CLERK';
type Officer = { id:string; username:string; displayName:string; role:Role };
type Status = 'ACTIVE'|'INACTIVE'|'ON_LEAVE'|'LEFT';
type Member = {
  id:string; characterName:string; jobClass:string|null; guildRole:string|null; combatRole:string|null;
  memberStatus:Status; joinedOn:string|null; legacyId:string|null; version:number;
};
type Snapshot = {
  id:string; memberId:string; weekStart:string; gearRating:number|null;
  sourceReference:string|null; version:number; reviewedAt:string|null; reviewedBy:string|null;
};
type MemberBody = Omit<Member,'id'|'legacyId'|'version'>;
type LegacyCandidate = MemberBody & { legacyId:string };
const initial: MemberBody = {
  characterName:'',jobClass:null,guildRole:null,combatRole:null,memberStatus:'ACTIVE',joinedOn:null
};
const labels:Record<Status,string>={ACTIVE:'Active',INACTIVE:'Inactive',ON_LEAVE:'On leave',LEFT:'Left guild'};
const roles=['DPS','Tank','Healer','Support','Flex'];
async function call<T>(path:string,options:RequestInit={},onExpired?:()=>void):Promise<T>{
  const res=await fetch(path,{
    credentials:'same-origin',cache:'no-store',...options,
    headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}
  });
  if(res.status===401)onExpired?.();
  if(!res.ok){
    const body=await res.json().catch(()=>({})) as {error?:string};
    throw new Error(body.error||`Request failed (${res.status})`);
  }
  return res.status===204 ? undefined as T : res.json() as Promise<T>;
}
function clean(value:string):string|null{return value.trim()||null;}
function legacyRoster():LegacyCandidate[]{
  // Reads only on a deliberate user action; never imports or deletes the original data automatically.
  const raw=localStorage.getItem('tnw-guild-ops-v1');
  if(!raw) return [];
  const obj=JSON.parse(raw) as {Members?:unknown};
  if(!Array.isArray(obj.Members))throw new Error('Legacy browser Members list was not found');
  if(obj.Members.length>250)throw new Error('More than 250 members; split and review outside this one-time import');
  return obj.Members.map((entry:unknown,index:number)=>{
    if(!entry || typeof entry!=='object')throw new Error(`Invalid legacy row ${index+1}`);
    const row=entry as Record<string,unknown>;
    const field=(key:string)=>typeof row[key]==='string'?String(row[key]).trim():'';
    const status:Record<string,Status>={'Active':'ACTIVE','Inactive':'INACTIVE','On Leave':'ON_LEAVE','Left':'LEFT'};
    const characterName=field('Character Name'), legacyId=field('Member ID');
    if(!characterName||!legacyId)throw new Error(`Missing member name or legacy ID in row ${index+1}`);
    if(!status[field('Status')] && field('Status'))throw new Error(`Unknown status for ${characterName}`);
    return {
      legacyId,characterName,jobClass:clean(field('Class')),
      guildRole:clean(field('Guild Rank')),combatRole:clean(field('Role')),
      memberStatus:status[field('Status')]||'ACTIVE',
      joinedOn:clean(field('Joined Date'))
    };
  });
}
function memberPayload(member:MemberBody):MemberBody {
  return {
    characterName:member.characterName.trim(),jobClass:member.jobClass,
    guildRole:member.guildRole,combatRole:member.combatRole,
    memberStatus:member.memberStatus,joinedOn:member.joinedOn
  };
}
function Field({title,value,onChange}:{title:string;value:string|null;onChange:(s:string)=>void}) {
  return <label className="roster-field"><span>{title}</span>
    <input value={value??''} onChange={e=>onChange(e.target.value)} maxLength={128}/></label>;
}
export default function RosterWorkspace({officer,onSignOut,onManageOfficers,onExpired}:{
  officer:Officer;onSignOut:()=>void;onManageOfficers:()=>void;onExpired:()=>void
}){
  const [section,setSection]=useState<'members'|'attendance'|'actions'|'mirror'|'league'>('members');
  const [members,setMembers]=useState<Member[]>([]);
  const [total,setTotal]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [snapshots,setSnapshots]=useState<Snapshot[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState<MemberBody>(initial);
  const [adding,setAdding]=useState(false);
  const [weekStart,setWeekStart]=useState('');
  const [rating,setRating]=useState('');
  const [source,setSource]=useState('');
  const [verified,setVerified]=useState(false);
  const [correcting,setCorrecting]=useState<Snapshot|null>(null);
  const [reason,setReason]=useState('');
  const [legacy,setLegacy]=useState<LegacyCandidate[]|null>(null);
  const [showImport,setShowImport]=useState(false);
  const [approval,setApproval]=useState(false);
  const selected=members.find(m=>m.id===selectedId)||null;
  const filtered=useMemo(()=>members.filter(m=>m.characterName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[members,search]);
  const active=members.filter(m=>m.memberStatus==='ACTIVE').length;

  async function loadMembers(keepSelected=true) {
    const data=await call<{members:Member[];total:number}>('/api/management/members?limit=250',{},onExpired);
    setMembers(data.members);setTotal(data.total);
    if(!keepSelected)setSelectedId(null);
    else setSelectedId(old=>old && data.members.some(m=>m.id===old)?old:null);
  }
  useEffect(()=>{
    let mounted=true;
    void call<{members:Member[];total:number}>('/api/management/members?limit=250',{},onExpired)
      .then(data=>{if(mounted){setMembers(data.members);setTotal(data.total);}})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not load guild roster');})
      .finally(()=>{if(mounted)setLoading(false);});
    return ()=>{mounted=false;};
  },[onExpired]);
  useEffect(()=>{
    if(!selectedId){setSnapshots([]);return;}
    let mounted=true;
    void call<{snapshots:Snapshot[]}>(`/api/management/members/${selectedId}/weekly-gr`,{},onExpired)
      .then(data=>{if(mounted)setSnapshots(data.snapshots);})
      .catch(e=>{if(mounted)setError(e instanceof Error?e.message:'Could not load weekly GR');});
    return ()=>{mounted=false;};
  },[selectedId,onExpired]);

  function edit(member:Member){
    setSelectedId(member.id);setForm({
      characterName:member.characterName,jobClass:member.jobClass,
      guildRole:member.guildRole,combatRole:member.combatRole,
      memberStatus:member.memberStatus,joinedOn:member.joinedOn
    });setEditing(true);setAdding(false);setError('');setMessage('');
  }
  function startNew(){
    setAdding(true);setEditing(false);setForm({...initial});setError('');setMessage('');
  }
  async function submitMember(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      if(editing&&selected){
        await call(`/api/management/members/${selected.id}`,{
          method:'PATCH',body:JSON.stringify({...memberPayload(form),version:selected.version})
        },onExpired);
      } else {
        const data=await call<{member:Member}>('/api/management/members',{
          method:'POST',body:JSON.stringify(memberPayload(form))
        },onExpired);
        setSelectedId(data.member.id);
      }
      setAdding(false);setEditing(false);await loadMembers();
      setMessage('Member record saved in PostgreSQL.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to save member');}
    finally{setBusy(false);}
  }
  function startCorrection(s:Snapshot){
    setCorrecting(s);setWeekStart(s.weekStart);setRating(s.gearRating===null?'':String(s.gearRating));
    setSource(s.sourceReference??'');setVerified(s.gearRating!==null);
    setReason('');setError('');setMessage('');
  }
  async function submitRating(e:FormEvent){
    e.preventDefault();if(!selected)return;
    setBusy(true);setError('');setMessage('');
    try {
      const numeric=rating.trim()===''?null:Number(rating);
      if(numeric!==null&&(!Number.isInteger(numeric)||numeric<=0))throw new Error('Gear Rating must be a positive whole number');
      if(numeric!==null&&(!verified||!source.trim()))throw new Error('Verify the source and acknowledge review before saving');
      const data={
        gearRating:numeric,sourceReference:clean(source),verified:numeric!==null&&verified,
        capturedAt:null
      };
      if(correcting){
        await call(`/api/management/members/${selected.id}/weekly-gr/${correcting.id}/correct`,{
          method:'POST',body:JSON.stringify({...data,reason,version:correcting.version})
        },onExpired);
      }else{
        await call(`/api/management/members/${selected.id}/weekly-gr`,{
          method:'POST',body:JSON.stringify({...data,weekStart})
        },onExpired);
      }
      const fresh=await call<{snapshots:Snapshot[]}>(`/api/management/members/${selected.id}/weekly-gr`,{},onExpired);
      setSnapshots(fresh.snapshots);setCorrecting(null);setWeekStart('');setRating('');setSource('');
      setVerified(false);setReason('');setMessage('Weekly GR record saved with review history.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to save weekly GR');}
    finally{setBusy(false);}
  }
  function previewLegacy(){
    setError('');setMessage('');
    try{
      const rows=legacyRoster();
      if(!rows.length){setError('No browser-local Members records found on this device.');return;}
      const names=rows.map(r=>r.characterName.toLocaleLowerCase()),ids=rows.map(r=>r.legacyId);
      if(new Set(names).size!==names.length||new Set(ids).size!==ids.length)throw new Error('Duplicate character names or IDs in browser roster. Resolve before import.');
      setLegacy(rows);setShowImport(true);setApproval(false);
    }catch(e){setError(e instanceof Error?e.message:'Cannot preview legacy roster');}
  }
  async function importLegacy(){
    if(!legacy||!approval||total!==0)return;
    if(!window.confirm(`Import ${legacy.length} member profiles into the empty server roster? This will not import Gear, Attendance, Performance or Evidence.`))return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await call<{imported:number}>('/api/management/roster-import',{
        method:'POST',body:JSON.stringify({members:legacy})
      },onExpired);
      await loadMembers(false);setShowImport(false);setLegacy(null);setApproval(false);
      setMessage(`Imported ${result.imported} roster profiles. Original browser data remains unchanged. Review names before continuing.`);
    }catch(e){setError(e instanceof Error?e.message:'Import rejected');}
    finally{setBusy(false);}
  }
  return <div className="roster-shell">
    <aside className="roster-sidebar">
      <div className="roster-brand"><span className="roster-mark">⚔</span><div><strong>AETERNUM</strong><small>Guild Operations</small></div></div>
      <span className="roster-section-label">MANAGEMENT</span>
      <button type="button" className={section==='members'?'roster-nav-active':'roster-nav-muted'} onClick={()=>setSection('members')}>
        ▦ <span>Member Registry</span>
      </button>
      <button type="button" className={section==='attendance'?'roster-nav-active':'roster-nav-muted'} onClick={()=>setSection('attendance')}>
        ◷ <span>Attendance</span>
      </button>
      {officer.role!=='CLERK'&&<button type="button" className={section==='actions'?'roster-nav-active':'roster-nav-muted'} onClick={()=>setSection('actions')}>
        ◈ <span>Member Action Center</span>
      </button>}
      <button type="button" className={section==='mirror'?'roster-nav-active':'roster-nav-muted'}
        onClick={()=>setSection('mirror')}>⚒ <span>Mirror World</span></button>
      <button type="button" className={section==='league'?'roster-nav-active':'roster-nav-muted'}
        onClick={()=>setSection('league')}>⚑ <span>Guild League</span></button>
      <div className="roster-nav-muted">◈ <span>Guild Siege — upcoming</span></div>
      <div className="roster-side-foot">
        <div className="roster-signed"><small>SIGNED IN</small><strong>{officer.displayName}</strong><span>{officer.role.replaceAll('_',' ')} · @{officer.username}</span></div>
        {officer.role==='GUILD_LEADER'&&<button onClick={onManageOfficers}>Manage officer accounts</button>}
        <button onClick={onSignOut}>Sign out</button>
      </div>
    </aside>
    <main className="roster-main">
      {section==='members'?<>
      <header className="roster-top">
        <div><span className="roster-eyebrow">GUILD COMMAND CENTER / ROSTER</span><h1>Member Registry</h1>
          <p>Server-backed members and verified weekly Gear Rating. No inferred scores.</p></div>
        <span className="roster-server-pill">● PostgreSQL · Shared</span>
      </header>
      {error&&<div className="roster-error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
      {message&&<div className="roster-success" role="status">{message}<button onClick={()=>setMessage('')}>Dismiss</button></div>}
      <section className="roster-kpis">
        <div><small>Registered members</small><strong>{total}</strong><span>Server database</span></div>
        <div><small>Active members</small><strong>{active}</strong><span>Current roster</span></div>
        <div><small>Selected member GR</small><strong>{snapshots.find(s=>s.gearRating!==null)?.gearRating?.toLocaleString()??'—'}</strong><span>Latest verified entry</span></div>
      </section>
      <div className="roster-layout">
        <section className="roster-card roster-registry">
          <div className="roster-card-title"><div><h2>Guild roster</h2><p>Names are matched by stable member ID, never list position.</p></div><button className="roster-primary" onClick={startNew}>+ Add member</button></div>
          <div className="roster-search"><input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search character name…" aria-label="Search members"/></div>
          {loading?<p>Loading roster…</p>:<div className="roster-table-wrap"><table><thead><tr>
            <th>Character</th><th>Class / combat role</th><th>Status</th><th></th>
          </tr></thead><tbody>
            {filtered.map(member=><tr key={member.id} className={selectedId===member.id?'roster-highlight':''}>
              <td><strong>{member.characterName}</strong><small>{member.guildRole||'Guild rank unknown'}</small></td>
              <td>{member.jobClass||'—'}<small>{member.combatRole||'—'}</small></td>
              <td><span className="roster-status">{labels[member.memberStatus]}</span></td>
              <td><button onClick={()=>{setSelectedId(member.id);setEditing(false);setAdding(false);setCorrecting(null);}}>View</button></td>
            </tr>)}
            {!filtered.length&&<tr><td colSpan={4} className="roster-empty">No members found. Add members or review a legacy import.</td></tr>}
          </tbody></table></div>}
          {total>members.length&&<p className="roster-note">Showing first {members.length} of {total} records. Server pagination is available; expanded table controls will follow.</p>}
          {total===0&&<div className="roster-import-trigger"><p>Have members in the old browser prototype?</p><button onClick={previewLegacy}>Preview browser roster import</button></div>}
        </section>
        <section className="roster-card roster-details">
          {(adding||editing)?<>
            <div className="roster-card-title"><h2>{editing?'Edit member':'New member'}</h2><button onClick={()=>{setEditing(false);setAdding(false);}}>Cancel</button></div>
            <form className="roster-form" onSubmit={e=>void submitMember(e)}>
              <label className="roster-field">Character name<input required minLength={1} maxLength={128} value={form.characterName}
                onChange={e=>setForm({...form,characterName:e.target.value})}/></label>
              <Field title="Class / job" value={form.jobClass} onChange={v=>setForm({...form,jobClass:clean(v)})}/>
              <label className="roster-field">Combat role<select value={form.combatRole??''} onChange={e=>setForm({...form,combatRole:clean(e.target.value)})}>
                <option value="">Unknown</option>{roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
              <Field title="In-game guild rank (not login role)" value={form.guildRole} onChange={v=>setForm({...form,guildRole:clean(v)})}/>
              <label className="roster-field">Status<select value={form.memberStatus} onChange={e=>setForm({...form,memberStatus:e.target.value as Status})}>
                {Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
              <label className="roster-field">Joined on<input type="date" value={form.joinedOn??''} onChange={e=>setForm({...form,joinedOn:clean(e.target.value)})}/></label>
              <button type="submit" className="roster-primary" disabled={busy}>{busy?'Saving…':'Save member'}</button>
            </form>
          </>:selected?<>
            <div className="roster-card-title"><div><h2>{selected.characterName}</h2><p>{selected.jobClass||'Class unknown'} · {selected.combatRole||'Role unknown'}</p></div>
              <button onClick={()=>edit(selected)}>Edit</button></div>
            <div className="roster-profile-facts"><span>Membership: <b>{labels[selected.memberStatus]}</b></span>
              <span>Guild rank: <b>{selected.guildRole||'—'}</b></span>
              <span>Joined: <b>{selected.joinedOn||'Unknown'}</b></span>
              <span>Record version: <b>{selected.version}</b></span></div>
            <div className="roster-subsection"><h3>Weekly Gear Rating</h3><p>Use your guild's chosen reporting-week start date. The roster Rating column is not automatically assumed to be GR.</p></div>
            <form className="roster-form" onSubmit={e=>void submitRating(e)}>
              <label className="roster-field">Reporting week start<input type="date" disabled={!!correcting} required value={weekStart} onChange={e=>setWeekStart(e.target.value)}/></label>
              <label className="roster-field">Verified Gear Rating (leave blank if unknown)<input type="number" min={1} step={1}
                value={rating} onChange={e=>setRating(e.target.value)} placeholder="e.g. 63000"/></label>
              <label className="roster-field">Source screenshot/file reference<input maxLength={255} value={source} onChange={e=>setSource(e.target.value)}
                placeholder="e.g. roster-2026-11-10-page1.png"/></label>
              <label className="roster-check"><input type="checkbox" checked={verified} disabled={!rating.trim()}
                onChange={e=>setVerified(e.target.checked)}/> I personally checked this GR against its source</label>
              {correcting&&<label className="roster-field">Correction reason (required)<textarea required minLength={5} maxLength={1000}
                value={reason} onChange={e=>setReason(e.target.value)} placeholder="Why was this week's entry corrected?"/></label>}
              <div className="roster-row-actions"><button className="roster-primary" type="submit" disabled={busy}>{correcting?'Save audited correction':'Record weekly GR'}</button>
                {correcting&&<button type="button" onClick={()=>{setCorrecting(null);setWeekStart('');setRating('');setSource('');setVerified(false);setReason('');}}>Cancel correction</button>}</div>
            </form>
            <div className="roster-snapshots"><h3>Reporting history</h3>
              {snapshots.map(s=><div className="roster-snapshot" key={s.id}>
                <div><strong>{s.weekStart}</strong><span>{s.gearRating===null?'Unknown':s.gearRating.toLocaleString()+' GR'}</span>
                  <small>{s.reviewedAt?'Human verified':'Awaiting verification'} · {s.sourceReference||'No source reference'} · v{s.version}</small></div>
                <button onClick={()=>startCorrection(s)}>Correct</button>
              </div>)}
              {!snapshots.length&&<p className="roster-note">No weekly GR yet. Unknown is not zero.</p>}
            </div>
          </>:<div className="roster-empty-details"><div>◇</div><h2>Select a guild member</h2><p>View their verified weekly GR snapshots or edit roster details.</p></div>}
        </section>
      </div>
      {showImport&&legacy&&<div className="roster-import-overlay" role="dialog" aria-modal="true" aria-label="Review browser roster import">
        <div className="roster-import-modal">
          <div className="roster-card-title"><div><h2>Review legacy roster import</h2><p>{legacy.length} member profiles from this browser only</p></div>
            <button onClick={()=>{setShowImport(false);setApproval(false);}}>Close</button></div>
          <p>This imports <b>names, class, combat role, in-game rank, status and join date</b> only into an <b>empty server roster</b>. It does not upload gear, attendance, performance, notes, screenshots or passwords. It will never delete the browser records.</p>
          <div className="roster-preview-list"><table><thead><tr><th>Legacy ID</th><th>Character</th><th>Class</th><th>Status</th></tr></thead><tbody>
            {legacy.map(m=><tr key={m.legacyId}><td>{m.legacyId}</td><td>{m.characterName}</td><td>{m.jobClass||'—'}</td><td>{labels[m.memberStatus]}</td></tr>)}
          </tbody></table></div>
          <label className="roster-check"><input type="checkbox" checked={approval} onChange={e=>setApproval(e.target.checked)}/>
            I reviewed these {legacy.length} member identities and understand that other browser records are not imported.</label>
          <div className="roster-row-actions"><button disabled={!approval||busy||total!==0} className="roster-primary" onClick={()=>void importLegacy()}>Confirm roster-only import</button>
            <button onClick={()=>{setShowImport(false);setApproval(false);}}>Cancel</button></div>
        </div>
      </div>}
      </>:section==='attendance'?<AttendanceView officer={officer} onExpired={onExpired}/>:
      section==='actions'?<ActionCenterView officer={officer} onExpired={onExpired}/>:
      section==='mirror'?<MirrorWorldView officer={officer} onExpired={onExpired}/>:
 <GuildLeagueView onExpired={onExpired}/>}
    </main>
  </div>;
}
