import { useCallback, useEffect, useState, type FormEvent } from 'react';
import './phase3-workspace.css';

type Role='GUILD_LEADER'|'OFFICER'|'CLERK';
type Context={officer:{id:string;role:Role};onExpired:()=>void};
type Member={id:string;characterName:string};
type Event={id:string;eventType:string;title:string;startsAt:string};
type Checkpoint={id:string;eventId:string;phase:'BEFORE'|'DURING'|'AFTER';capturedAt:string;evidenceRef:string;coverage:string};
type Observation={id:string;checkpointId:string;memberId:string;status:string;characterName:string;version:number};
type Assessment={id:string;memberId:string;assessment:string;rationale:string;version:number;verificationMethod:string|null;evidenceRef:string|null};
type CaseRow={id:string;memberId:string;characterName:string;caseType:string;status:string;version:number;eventId:string|null;assignedOfficerId:string|null;followUpOn:string|null};
type CaseDetail={case:{id:string;memberId:string;status:string;version:number;assignedOfficerId:string|null;followUpOn:string|null;officerDetermination:string|null};notes:{id:string;kind:string;content:string;source:string|null;createdAt:string}[];audit:{id:string;action:string;createdAt:string}[]};
const eventTypes=['GUILD_LEAGUE','HAZY_FOREST','GUILD_SIEGE'] as const;
const phases=['BEFORE','DURING','AFTER'] as const;
const assessmentTypes=['NEEDS_REVIEW','LIKELY_PRESENT','LIKELY_ABSENT','CONFIRMED_PARTICIPATED'] as const;
const caseTypes=['ABSENCE_FOLLOWUP','AFK_REPORT','AWOL_REVIEW','GENERAL'] as const;
const caseStatuses=['OPEN','AWAITING_RESPONSE','IN_REVIEW','EXCUSED','UNEXCUSED','ESCALATED','RESOLVED'] as const;
const base='/api/management';
function localInput(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function dateInstant(value:string){const d=new Date(value);if(Number.isNaN(d.getTime()))throw new Error('Select a valid date/time');return d.toISOString();}
function stamp(value:string){return new Date(value).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'});}
function nice(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());}
async function api<T>(path:string,options:RequestInit={},onExpired?:()=>void):Promise<T>{
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,
    headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  if(response.status===401)onExpired?.();
  if(!response.ok){const data=await response.json().catch(()=>({})) as {error?:string};
    throw new Error(data.error||`Request failed (${response.status})`);}
  return response.status===204?undefined as T:response.json() as Promise<T>;
}
function useMembers(onExpired:()=>void){
  const [members,setMembers]=useState<Member[]>([]);
  const [count,setCount]=useState(0);
  useEffect(()=>{let active=true;
    void api<{members:Member[];total:number}>(base+'/members?limit=250',{},onExpired).then(data=>{
      if(active){setMembers(data.members);setCount(data.total);}
    }).catch(()=>{});
    return()=>{active=false;};
  },[onExpired]);
  return {members,count};
}
function ErrorMessage({error,notice}:{error:string;notice:string}){
  return <>{error&&<p role="alert" className="phase-error">{error}</p>}
    {notice&&<p role="status" className="phase-success">{notice}</p>}</>;
}
function MemberPicker({members,value,onChange}:{members:Member[];value:string;onChange:(v:string)=>void}){
  return <label className="phase-field">Guild member<select required value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">Choose a member</option>{members.map(m=><option key={m.id} value={m.id}>{m.characterName}</option>)}
  </select></label>;
}

export function AttendanceView({officer,onExpired}:Context){
  const {members,count}=useMembers(onExpired);
  const [events,setEvents]=useState<Event[]>([]);
  const [chosen,setChosen]=useState('');
  const [data,setData]=useState<{event:Event;checkpoints:Checkpoint[];observations:Observation[]}|null>(null);
  const [assessments,setAssessments]=useState<Assessment[]>([]);
  const [eventType,setEventType]=useState<typeof eventTypes[number]>('GUILD_LEAGUE');
  const [eventTitle,setEventTitle]=useState('');
  const [eventDate,setEventDate]=useState(localInput);
  const [phase,setPhase]=useState<typeof phases[number]>('BEFORE');
  const [captured,setCaptured]=useState(localInput);
  const [coverage,setCoverage]=useState<'PARTIAL'|'UNKNOWN'|'COMPLETE'>('PARTIAL');
  const [evidence,setEvidence]=useState('');
  const [checkpointId,setCheckpointId]=useState('');
  const [memberId,setMemberId]=useState('');
  const [status,setStatus]=useState<'ONLINE'|'OFFLINE'|'UNKNOWN'>('UNKNOWN');
  const [checked,setChecked]=useState(false);
  const [reviewMember,setReviewMember]=useState('');
  const [reviewStatus,setReviewStatus]=useState<typeof assessmentTypes[number]>('NEEDS_REVIEW');
  const [rationale,setRationale]=useState('');
  const [reviewMethod,setReviewMethod]=useState('BATTLE_REPORT');
  const [reviewEvidence,setReviewEvidence]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const reviewer=officer.role!=='CLERK';
  const refreshEvents=useCallback(async()=>{
    const r=await api<{events:Event[]}>(base+'/attendance/events',{},onExpired);setEvents(r.events);
  },[onExpired]);
  const refreshDetail=useCallback(async(id:string)=>{
    const r=await api<{event:Event;checkpoints:Checkpoint[];observations:Observation[]}>(base+'/attendance/events/'+id,{},onExpired);
    setData(r);
    if(reviewer){const a=await api<{assessments:Assessment[]}>(base+'/attendance/events/'+id+'/assessments',{},onExpired);
      setAssessments(a.assessments);}else setAssessments([]);
  },[onExpired,reviewer]);
  useEffect(()=>{void refreshEvents().catch(e=>setError(String(e)));},[refreshEvents]);
  useEffect(()=>{if(chosen){void refreshDetail(chosen).catch(e=>setError(String(e)));}else setData(null);},[chosen,refreshDetail]);
  async function submit(fn:()=>Promise<void>){
    setBusy(true);setError('');setNotice('');
    try{await fn();}catch(e){setError(e instanceof Error?e.message:'Unable to save');}
    finally{setBusy(false);}
  }
  function createEvent(e:FormEvent){e.preventDefault();void submit(async()=>{
    const r=await api<{event:Event}>(base+'/attendance/events',{method:'POST',
      body:JSON.stringify({eventType,title:eventTitle,startsAt:dateInstant(eventDate)})},onExpired);
    await refreshEvents();setChosen(r.event.id);setNotice('Event created. Add reviewed capture references.');
  });}
  function addCheckpoint(e:FormEvent){e.preventDefault();if(!chosen)return;void submit(async()=>{
    await api(base+'/attendance/events/'+chosen+'/checkpoints',{method:'POST',body:JSON.stringify({
      phase,capturedAt:dateInstant(captured),evidenceRef:evidence,coverage
    })},onExpired);
    await refreshDetail(chosen);setEvidence('');setNotice('Checkpoint saved; now record visible member observations.');
  });}
  function addObservation(e:FormEvent){e.preventDefault();if(!chosen||!checkpointId)return;void submit(async()=>{
    await api(base+`/attendance/events/${chosen}/checkpoints/${checkpointId}/observations`,{
      method:'POST',body:JSON.stringify({reviewed:checked,observations:[{memberId,status}]})
    },onExpired);
    await refreshDetail(chosen);setChecked(false);setMemberId('');setStatus('UNKNOWN');
    setNotice('Explicit observation saved. Other members remain unobserved, not offline.');
  });}
  function reviewAttendance(e:FormEvent){e.preventDefault();if(!chosen)return;void submit(async()=>{
    const old=assessments.find(x=>x.memberId===reviewMember);
    const fields={memberId:reviewMember,assessment:reviewStatus,rationale,
      verificationMethod:reviewStatus==='CONFIRMED_PARTICIPATED'?reviewMethod:null,
      evidenceRef:reviewStatus==='CONFIRMED_PARTICIPATED'?reviewEvidence.trim()||null:null};
    if(old)await api(base+`/attendance/events/${chosen}/assessments/${old.id}`,{
      method:'PATCH',body:JSON.stringify({...fields,version:old.version})
    },onExpired);
    else await api(base+'/attendance/events/'+chosen+'/assessments',{
      method:'POST',body:JSON.stringify(fields)
    },onExpired);
    await refreshDetail(chosen);setRationale('');setReviewEvidence('');
    setNotice('Officer review recorded with history. No AFK/AWOL case was created.');
  });}
  const currentCp=data?.checkpoints.find(c=>c.id===checkpointId);
  const existing=data?.observations.filter(o=>o.checkpointId===checkpointId)||[];
  const observedSet=new Set(existing.map(o=>o.memberId));
  const complete=new Set(data?.checkpoints.filter(c=>c.coverage==='COMPLETE').map(c=>c.phase)||[]);
  return <section className="phase-layout">
    <header className="phase-header"><span className="roster-eyebrow">GUILD COMMAND CENTER / ACTIVITY</span>
      <h1>Attendance & Evidence</h1><p>Capture Before / During / After. Online is not confirmation of participation.</p></header>
    <ErrorMessage error={error} notice={notice}/>
    <div className="phase-grid">
      <section className="roster-card">
        <div className="phase-title"><h2>Event sessions</h2><span>{events.length} recorded</span></div>
        <form className="phase-form" onSubmit={createEvent}>
          <label className="phase-field">Activity type<select value={eventType} onChange={e=>setEventType(e.target.value as typeof eventType)}>
            {eventTypes.map(x=><option key={x} value={x}>{nice(x)}</option>)}</select></label>
          <label className="phase-field">Title<input required minLength={3} maxLength={160} value={eventTitle}
            onChange={e=>setEventTitle(e.target.value)} placeholder="Guild League — Week 1"/></label>
          <label className="phase-field">Event date/time (your local timezone)<input type="datetime-local" required value={eventDate}
            onChange={e=>setEventDate(e.target.value)}/></label>
          <button type="submit" className="roster-primary" disabled={busy}>Create event</button>
        </form>
        <h3>Recent events</h3>
        <div className="phase-list">{events.map(ev=><button key={ev.id} className={chosen===ev.id?'phase-selected':''}
          type="button" onClick={()=>{setChosen(ev.id);setCheckpointId('');}}>
          <strong>{ev.title}</strong><small>{nice(ev.eventType)} · {stamp(ev.startsAt)}</small></button>)}
          {!events.length&&<p className="roster-note">No activity sessions yet.</p>}</div>
      </section>
      <section className="roster-card">
        <div className="phase-title"><h2>Checkpoint coverage</h2><span>Observed ≠ participated</span></div>
        {!data?<p className="roster-note">Select an event to capture evidence.</p>:<>
          <div className="phase-checkpoints">{phases.map(p=><div key={p} className={complete.has(p)?'phase-captured':''}>
            <strong>{p}</strong><small>{data.checkpoints.filter(c=>c.phase===p).length} capture(s)</small></div>)}</div>
          <p className="phase-hint">Coverage describes screenshot page completeness; do not mark COMPLETE unless the relevant roster was fully covered. Multiple images per checkpoint are supported.</p>
          <form className="phase-form" onSubmit={addCheckpoint}>
            <label className="phase-field">Checkpoint<select value={phase} onChange={e=>setPhase(e.target.value as typeof phase)}>
              {phases.map(p=><option key={p}>{p}</option>)}</select></label>
            <label className="phase-field">Captured at (local time)<input type="datetime-local" required value={captured} onChange={e=>setCaptured(e.target.value)}/></label>
            <label className="phase-field">Roster page coverage<select value={coverage} onChange={e=>setCoverage(e.target.value as typeof coverage)}>
              <option value="PARTIAL">Partial / cropped</option><option value="UNKNOWN">Unknown</option><option value="COMPLETE">Complete / verified</option>
            </select></label>
            <label className="phase-field">Screenshot filename / private reference<input required minLength={3} maxLength={255}
              value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="guild-league-before-p1.png"/></label>
            <button disabled={busy} className="roster-primary">Add evidence checkpoint</button>
          </form>
          <div className="phase-list">{data.checkpoints.map(c=><button key={c.id} type="button"
            className={checkpointId===c.id?'phase-selected':''} onClick={()=>setCheckpointId(c.id)}>
            <strong>{c.phase} · {stamp(c.capturedAt)}</strong>
            <small>{c.coverage} · {c.evidenceRef} · {data.observations.filter(o=>o.checkpointId===c.id).length} observed</small>
          </button>)}</div>
        </>}
      </section>
    </div>
    {data&&<div className="phase-grid">
      <section className="roster-card">
        <div className="phase-title"><h2>Explicit member observations</h2><span>{currentCp?.phase||'Choose checkpoint'}</span></div>
        {!currentCp?<p className="roster-note">Choose a checkpoint above to record visible members.</p>:<>
          <p className="phase-hint">A member missing from a screenshot is <b>not observed</b>. OFFLINE is allowed only if the screenshot explicitly shows that member as offline.</p>
          {count>members.length&&<p className="phase-error">Member picker shows the first {members.length} of {count} members. Searchable paging will follow.</p>}
          <form className="phase-form" onSubmit={addObservation}>
            <MemberPicker members={members.filter(m=>!observedSet.has(m.id))} value={memberId} onChange={setMemberId}/>
            <label className="phase-field">Visible screenshot status<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
              <option value="UNKNOWN">Unknown / ambiguous</option><option value="ONLINE">Explicitly online</option><option value="OFFLINE">Explicitly offline</option>
            </select></label>
            <label className="phase-checkbox"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>
              I verified this member's visible status against the referenced evidence</label>
            <button disabled={busy||!checked||!memberId} className="roster-primary">Save observation</button>
          </form>
          <div className="phase-list">{existing.map(o=><div key={o.id} className="phase-evidence-row">
            <b>{o.characterName}</b><span>{o.status} · v{o.version}</span></div>)}</div>
        </>}
      </section>
      <section className="roster-card">
        <div className="phase-title"><h2>Participation assessment</h2><span>Officer judgment</span></div>
        {!reviewer?<p className="phase-hint">Clerks can capture evidence. Only Officers and the Guild Leader can issue participation judgments or see private rationale.</p>:<>
          <p className="phase-hint">LIKELY_ABSENT requires explicit offline observations across all three COMPLETE checkpoints. CONFIRMED_PARTICIPATED requires direct battle or officer evidence. No automatic decisions.</p>
          <form className="phase-form" onSubmit={reviewAttendance}>
            <MemberPicker members={members} value={reviewMember} onChange={setReviewMember}/>
            <label className="phase-field">Assessment<select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value as typeof reviewStatus)}>
              {assessmentTypes.map(a=><option key={a} value={a}>{nice(a)}</option>)}</select></label>
            {reviewStatus==='CONFIRMED_PARTICIPATED'&&<>
              <label className="phase-field">Verification method<select value={reviewMethod} onChange={e=>setReviewMethod(e.target.value)}>
                <option value="BATTLE_REPORT">Battle report</option><option value="OFFICER_CONFIRMATION">Officer confirmation</option></select></label>
              <label className="phase-field">Direct evidence reference<input value={reviewEvidence} maxLength={255} required onChange={e=>setReviewEvidence(e.target.value)}/></label>
            </>}
            <label className="phase-field">Officer rationale<textarea required minLength={8} maxLength={1600} value={rationale}
              onChange={e=>setRationale(e.target.value)} placeholder="What supports your review?"/></label>
            <button disabled={busy||!reviewMember} className="roster-primary">Record officer assessment</button>
          </form>
          <div className="phase-list">{assessments.map(a=><div className="phase-evidence-row" key={a.id}>
            <span>{members.find(m=>m.id===a.memberId)?.characterName||a.memberId.slice(0,8)} — {nice(a.assessment)}</span>
            <small>v{a.version} · {a.rationale}</small></div>)}
          </div>
        </>}
      </section>
    </div>}
  </section>;
}

export function ActionCenterView({officer,onExpired}:Context){
  const allowed=officer.role!=='CLERK';
  const {members}=useMembers(onExpired);
  const [cases,setCases]=useState<CaseRow[]>([]);
  const [selected,setSelected]=useState('');
  const [detail,setDetail]=useState<CaseDetail|null>(null);
  const [memberId,setMemberId]=useState('');
  const [caseType,setCaseType]=useState<typeof caseTypes[number]>('ABSENCE_FOLLOWUP');
  const [openingNote,setOpeningNote]=useState('');
  const [followUp,setFollowUp]=useState('');
  const [status,setStatus]=useState<typeof caseStatuses[number]>('OPEN');
  const [determination,setDetermination]=useState('');
  const [noteKind,setNoteKind]=useState<'MEMBER_REPORT'|'OFFICER_NOTE'>('OFFICER_NOTE');
  const [note,setNote]=useState('');
  const [source,setSource]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const refresh=useCallback(async()=>{
    if(!allowed)return;
    const data=await api<{cases:CaseRow[]}>(base+'/action-cases',{},onExpired);setCases(data.cases);
  },[onExpired,allowed]);
  const load=useCallback(async(id:string)=>{
    const data=await api<CaseDetail>(base+'/action-cases/'+id,{},onExpired);
    setDetail(data);setStatus(data.case.status as typeof status);
    setDetermination(data.case.officerDetermination||'');
    setFollowUp(data.case.followUpOn||'');
  },[onExpired]);
  useEffect(()=>{void refresh().catch(e=>setError(String(e)));},[refresh]);
  useEffect(()=>{if(selected)void load(selected).catch(e=>setError(String(e)));else setDetail(null);},[selected,load]);
  async function submit(fn:()=>Promise<void>){
    setBusy(true);setError('');setNotice('');
    try{await fn();}catch(e){setError(e instanceof Error?e.message:'Unable to save');}
    finally{setBusy(false);}
  }
  function create(e:FormEvent){e.preventDefault();void submit(async()=>{
    const result=await api<{case:{id:string}}>(base+'/action-cases',{method:'POST',
      body:JSON.stringify({memberId,caseType,openingNote,eventId:null,followUpOn:followUp||null})},onExpired);
    setOpeningNote('');await refresh();setSelected(result.case.id);
    setNotice('Case opened explicitly by an officer. No automatic disciplinary decision.');
  });}
  function update(e:FormEvent){e.preventDefault();if(!detail)return;void submit(async()=>{
    await api(base+'/action-cases/'+detail.case.id,{method:'PATCH',body:JSON.stringify({
      status,version:detail.case.version,assignedOfficerId:detail.case.assignedOfficerId,
      followUpOn:followUp||null,officerDetermination:determination.trim()||null
    })},onExpired);
    await load(detail.case.id);await refresh();setNotice('Officer decision recorded in case audit history.');
  });}
  function addNote(e:FormEvent){e.preventDefault();if(!detail)return;void submit(async()=>{
    await api(base+'/action-cases/'+detail.case.id+'/notes',{method:'POST',body:JSON.stringify({
      kind:noteKind,content:note,source:noteKind==='MEMBER_REPORT'?source.trim()||null:null,reportedAt:null
    })},onExpired);
    setNote('');setSource('');await load(detail.case.id);setNotice('Private, attributed note appended to the case.');
  });}
  return <section className="phase-layout">
    <header className="phase-header"><span className="roster-eyebrow">GUILD COMMAND CENTER / PRIVATE REVIEW</span>
      <h1>Member Action Center</h1><p>Officer-only casework. No automatic AFK or AWOL labels from screenshots.</p></header>
    {!allowed?<div className="roster-card"><h2>Restricted officer records</h2><p>Member explanations and disciplinary review are available only to the Guild Leader and Officers.</p></div>:<>
      <ErrorMessage error={error} notice={notice}/>
      <div className="phase-grid">
        <section className="roster-card">
          <div className="phase-title"><h2>Open a follow-up</h2><span>Private</span></div>
          <form className="phase-form" onSubmit={create}>
            <MemberPicker members={members} value={memberId} onChange={setMemberId}/>
            <label className="phase-field">Case type<select value={caseType} onChange={e=>setCaseType(e.target.value as typeof caseType)}>
              {caseTypes.map(t=><option key={t} value={t}>{nice(t)}</option>)}</select></label>
            <label className="phase-field">Officer opening note<textarea required minLength={8} maxLength={3000} value={openingNote}
              onChange={e=>setOpeningNote(e.target.value)} placeholder="Describe why human follow-up is needed; no assumptions."/></label>
            <label className="phase-field">Follow-up date (optional)<input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)}/></label>
            <button disabled={busy} className="roster-primary">Create private case</button>
          </form>
          <div className="phase-title"><h3>Case queue</h3><span>{cases.length}</span></div>
          <div className="phase-list">{cases.map(c=><button key={c.id} type="button" className={selected===c.id?'phase-selected':''}
            onClick={()=>setSelected(c.id)}><strong>{c.characterName}</strong><small>{nice(c.caseType)} · {nice(c.status)}</small></button>)}
          {!cases.length&&<p className="roster-note">No cases yet.</p>}</div>
        </section>
        <section className="roster-card">
          {!detail?<div className="roster-empty-details"><h2>Select a private case</h2><p>Cases are visible only to approved Officers and Guild Leaders.</p></div>:<>
            <div className="phase-title"><h2>Case review</h2><span>Version {detail.case.version}</span></div>
            <p className="phase-hint">Member: {members.find(m=>m.id===detail.case.memberId)?.characterName||'Member'}</p>
            <form className="phase-form" onSubmit={update}>
              <label className="phase-field">Officer disposition<select value={status} onChange={e=>setStatus(e.target.value as typeof status)}>
                {caseStatuses.map(s=><option value={s} key={s}>{nice(s)}</option>)}</select></label>
              <label className="phase-field">Officer determination<textarea maxLength={3000} value={determination}
                onChange={e=>setDetermination(e.target.value)} placeholder="Required for excused, unexcused and escalated decisions"/></label>
              <label className="phase-field">Follow-up on<input type="date" value={followUp} onChange={e=>setFollowUp(e.target.value)}/></label>
              <button disabled={busy} className="roster-primary">Save reviewed disposition</button>
            </form>
            <div className="phase-title"><h3>Private timeline</h3><span>{detail.notes.length} notes</span></div>
            <div className="phase-list">{detail.notes.map(n=><div key={n.id} className="phase-evidence-row">
              <strong>{nice(n.kind)} · {stamp(n.createdAt)}</strong>
              <span>{n.content}</span>{n.source&&<small>Reported via {n.source}</small>}</div>)}</div>
            <form className="phase-form phase-note-form" onSubmit={addNote}>
              <label className="phase-field">Note type<select value={noteKind} onChange={e=>setNoteKind(e.target.value as typeof noteKind)}>
                <option value="OFFICER_NOTE">Officer assessment/comment</option>
                <option value="MEMBER_REPORT">Member-reported reason</option></select></label>
              {noteKind==='MEMBER_REPORT'&&<label className="phase-field">Report source (e.g. guild chat)<input required minLength={2}
                value={source} onChange={e=>setSource(e.target.value)}/></label>}
              <label className="phase-field">Private note<textarea required minLength={3} maxLength={3000} value={note}
                onChange={e=>setNote(e.target.value)}/></label>
              <button disabled={busy} className="roster-primary">Append attributed note</button>
            </form>
            <details className="phase-audit"><summary>Case change history ({detail.audit.length})</summary>
              {detail.audit.map(a=><p key={a.id}>{nice(a.action)} · {stamp(a.createdAt)}</p>)}</details>
          </>}
        </section>
      </div>
    </>}
  </section>;
}
