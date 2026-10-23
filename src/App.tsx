import { useMemo, useRef, useState } from 'react';
import { Activity, AlertCircle, ArrowDownToLine, ArrowUpFromLine, BarChart3, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, FileImage, FileSpreadsheet, LayoutDashboard, Plus, Search, ShieldCheck, Sparkles, Swords, Trash2, Users, X } from 'lucide-react';
import { DEF, HEADERS, SHEETS, displayRecord, type Field, type GuildData, type RecordRow, type SheetName } from './types';
import { load, save } from './lib/storage';
import { readGuildWorkbook, saveGuildWorkbook } from './lib/workbook';
import { readScreenshot, removeScreenshot, storeScreenshot } from './lib/media';

type Page = 'Dashboard' | SheetName;
const NAV: {name:Page; icon:typeof Users}[]=[
  {name:'Dashboard',icon:LayoutDashboard},{name:'Members',icon:Users},{name:'Gear',icon:Swords},
  {name:'Events',icon:CalendarDays},{name:'Attendance',icon:ClipboardCheck},
  {name:'Performance',icon:BarChart3},{name:'Evidence',icon:FileImage}
];
const today=()=>new Date().toISOString().slice(0,10);
const defaults=(page:SheetName):RecordRow=>{
  const row:RecordRow={};DEF[page].fields.forEach(f=>row[f.key]='');
  if(page==='Members')row.Status='Active';
  if(page==='Events')row.Status='Scheduled';
  if(page==='Gear' || page==='Performance')row.Verified='No';
  if(page==='Evidence')row['Review Status']='Pending';
  for(const k of ['Snapshot Date','Event Date','Recorded At','Uploaded At'])if(k in row)row[k]=today();
  return row;
};
const makeId=(prefix:string)=>`${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const normal=(v:string)=>v.toLocaleLowerCase().trim();
const short=(t:string,n=54)=>t.length>n?t.slice(0,n-1)+'…':t;

function Kpi({title,value,icon:Icon,foot}:{title:string;value:string|number;icon:typeof Users;foot:string}){
  return <div className="kpi"><div className="kpi-head"><span>{title}</span><Icon size={18}/></div><strong>{value}</strong><small>{foot}</small></div>;
}

export default function App(){
  const [data,setData]=useState<GuildData>(()=>load());
  const [page,setPage]=useState<Page>('Dashboard');
  const [query,setQuery]=useState('');
  const [isAdding,setAdding]=useState(false);
  const [form,setForm]=useState<RecordRow>(()=>defaults('Members'));
  const [editing,setEditing]=useState<string|null>(null);
  const [screenshot,setScreenshot]=useState<File|null>(null);
  const [preview,setPreview]=useState<string|null>(null);
  const [viewer,setViewer]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  const importRef=useRef<HTMLInputElement>(null);
  const active=(page==='Dashboard'?null:page) as SheetName|null;
  const memberMap=useMemo(()=>Object.fromEntries(data.Members.map(m=>[m['Member ID'],m['Character Name']])),[data.Members]);
  const eventMap=useMemo(()=>Object.fromEntries(data.Events.map(e=>[e['Event ID'],`${e['Event Name']} (${e['Event Date']})`])),[data.Events]);
  const counted=data.Attendance.filter(r=>['Present','Late','Absent'].includes(r['Attendance Status']));
  const appeared=counted.filter(r=>['Present','Late'].includes(r['Attendance Status'])).length;
  const rate=counted.length?`${Math.round(appeared/counted.length*100)}%`:'—';
  const pending=data.Evidence.filter(e=>e['Review Status']==='Pending').length;
  const verified=data.Gear.filter(g=>g.Verified==='Yes').length;
  const activeMembers=data.Members.filter(m=>m.Status==='Active').length;

  function commit(next:GuildData){setData(next);try{save(next);}catch{setNotice('Browser storage is full. Export Excel now to avoid losing work.');}}
  function go(next:Page){if(preview)URL.revokeObjectURL(preview);setPage(next);setQuery('');setAdding(false);setEditing(null);setScreenshot(null);setPreview(null);setNotice('');}
  function startAdd(){if(!active)return;setForm(defaults(active));setEditing(null);setScreenshot(null);setPreview(null);setAdding(true);setNotice('');}
  function startEdit(row:RecordRow){if(!active)return;setForm({...row});setEditing(row[DEF[active].idKey]);setAdding(true);setNotice('');setScreenshot(null);setPreview(null);window.scrollTo({top:0,behavior:'smooth'});}
  function cancelAdd(){setAdding(false);setEditing(null);setScreenshot(null);if(preview)URL.revokeObjectURL(preview);setPreview(null);}
  async function submit(){
    if(!active)return;
    for(const f of DEF[active].fields){if(f.required&&!form[f.key]?.trim()){setNotice(`Please fill out ${f.label}.`);return;}}
    if(active==='Attendance'){
      const dup=data.Attendance.find(r=>r['Event ID']===form['Event ID']&&r['Member ID']===form['Member ID']&&r['Attendance ID']!==editing);
      if(dup){setNotice('This member already has attendance for this event. Edit the existing entry instead.');return;}
    }
    const idKey=DEF[active].idKey;
    const id=editing||makeId(DEF[active].prefix);
    const row={...form,[idKey]:id};
    const next={...data,[active]:editing?data[active].map(x=>x[idKey]===editing?row:x):[row,...data[active]]};
    if(active==='Evidence' && screenshot){try{await storeScreenshot(id,screenshot);}catch{setNotice('Could not save image locally. Record was not added.');return;}}
    commit(next);cancelAdd();setNotice(editing?'Record updated.':'Record added.');
  }
  async function remove(row:RecordRow){
    if(!active)return;
    const idKey=DEF[active].idKey, id=row[idKey];
    if(active==='Members' && SHEETS.some(s=>s!=='Members' && data[s].some(r=>r['Member ID']===id))) {setNotice('Member is referenced by other records. Change Status to Left instead of deleting.');return;}
    if(active==='Events' && (data.Attendance.some(a=>a['Event ID']===id)||data.Performance.some(p=>p['Event ID']===id)||data.Evidence.some(e=>e['Event ID']===id))){setNotice('Event has linked records and cannot be deleted.');return;}
    if(!window.confirm(`Delete ${displayRecord(row,active)}? This cannot be undone.`))return;
    commit({...data,[active]:data[active].filter(r=>r[idKey]!==id)});
    if(active==='Evidence')await removeScreenshot(id).catch(()=>{});
    setNotice('Record deleted.');
  }
  async function viewScreenshot(id:string){
    try {
      const b=await readScreenshot(id);
      if(!b){setNotice('This image is not in this browser. Excel exports contain references, not image blobs.');return;}
      if(viewer) URL.revokeObjectURL(viewer);
      setViewer(URL.createObjectURL(b));
    }catch{setNotice('Unable to open the locally stored screenshot.');}
  }
  async function importExcel(file?:File){if(!file)return;
    if(SHEETS.some(s=>data[s].length>0) && !window.confirm('Importing will REPLACE all browser records with the workbook contents. Export a backup first if needed. Continue?'))return;
    try{const imported=await readGuildWorkbook(file);commit(imported);setNotice(`Imported ${SHEETS.reduce((total,s)=>total+imported[s].length,0)} rows from ${file.name}.`);}
    catch(e){setNotice(`Import failed: ${e instanceof Error?e.message:'Unknown Excel file error'}`);}
    if(importRef.current)importRef.current.value='';
  }
  async function exportExcel(){try{await saveGuildWorkbook(data);setNotice('Excel workbook downloaded.');}catch(e){setNotice(`Export failed: ${e instanceof Error?e.message:'Unknown error'}`);}}
  function field(f:Field){
    const value=form[f.key]??'';
    const update=(x:string)=>setForm(o=>({...o,[f.key]:x}));
    if(f.reference){const options=f.reference==='member'?data.Members:data.Events;const nameKey=f.reference==='member'?'Member ID':'Event ID';const labelKey=f.reference==='member'?'Character Name':'Event Name';
      return <select value={value} onChange={e=>update(e.target.value)} required={f.required}><option value="">Choose {f.reference}</option>{options.map(o=><option key={o[nameKey]} value={o[nameKey]}>{o[labelKey]}{f.reference==='event'?` · ${o['Event Date']}`:''}</option>)}</select>;
    }
    if(f.type==='select')return <select value={value} onChange={e=>update(e.target.value)} required={f.required}><option value="">Select…</option>{f.options?.map(o=><option key={o} value={o}>{o}</option>)}</select>;
    if(f.type==='textarea')return <textarea rows={2} value={value} placeholder={f.label} onChange={e=>update(e.target.value)}/>;
    return <input value={value} type={f.type||'text'} step={f.type==='number'?'any':undefined} placeholder={f.label} onChange={e=>update(e.target.value)} required={f.required}/>;
  }
  const rows=active?data[active].filter(r=>!query||Object.values(r).some(v=>normal(v).includes(normal(query))) ):[];
  function displayCell(row:RecordRow,key:string){
    const val=row[key]||'—';
    if(key==='Member ID')return <span title={row[key]}>{memberMap[val]||short(val,23)}</span>;
    if(key==='Event ID')return <span title={row[key]}>{short(eventMap[val]||val,27)}</span>;
    if(['Status','Verified','Attendance Status','Review Status'].includes(key))return <span className={`status ${normal(val).replaceAll(' ','-')}`}>{val}</span>;
    return <span title={val}>{short(val,43)}</span>;
  }
  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><Swords size={21}/></div><div><b>TNW <span>GUILD OPS</span></b><small>Operations command center</small></div></div>
      <div className="side-label">WORKSPACE</div>
      <nav>{NAV.map(({name,icon:Icon})=><button key={name} className={`nav ${page===name?'current':''}`} onClick={()=>go(name)}><Icon size={17}/><span>{name==='Gear'?'Equipment':name}</span>{name==='Evidence'&&pending>0?<em>{pending}</em>:null}</button>)}</nav>
      <div className="side-bottom"><div className="local-label"><ShieldCheck size={16}/> Local-first workspace</div><p>Records stay in this browser until you export or deploy a shared backend.</p><div className="side-version">TNW Ops · MVP 0.1</div></div>
    </aside>
    <div className="content">
      <header className="topbar"><div className="crumb">GUILD MANAGEMENT <span>/</span> {page.toUpperCase()}</div><div className="toolbar"><input ref={importRef} className="hidden" type="file" accept=".xlsx" onChange={e=>void importExcel(e.target.files?.[0])}/><button className="btn secondary" onClick={()=>importRef.current?.click()}><ArrowUpFromLine size={16}/> Import Excel</button><button className="btn primary" onClick={()=>void exportExcel()}><ArrowDownToLine size={16}/> Export .xlsx</button></div></header>
      <main>
        <div className="page-head"><div><div className="eyebrow"><span className="live-dot"/> RAGNAROK: THE NEW WORLD</div><h1>{page==='Dashboard'?'Guild overview':page==='Gear'?'Equipment snapshots':page==='Members'?'Guild roster':page}</h1><p>{page==='Dashboard'?'Your members, activity and evidence at a glance.':DEF[page].description}</p></div><div className="head-right">{active&&<button className="btn primary add-btn" onClick={startAdd}><Plus size={18}/> Add {page==='Members'?'member':'record'}</button>}</div></div>
        {notice&&<div className="notice"><AlertCircle size={17}/><span>{notice}</span><button aria-label="Dismiss notice" onClick={()=>setNotice('')}><X size={16}/></button></div>}
        {page==='Dashboard'?<>
          <section className="kpi-grid"><Kpi title="Active members" value={activeMembers} icon={Users} foot={`${data.Members.length} total profiles`}/><Kpi title="Events logged" value={data.Events.length} icon={CalendarDays} foot={`${data.Events.filter(e=>e.Status==='Completed').length} completed`}/><Kpi title="Attendance rate" value={rate} icon={Activity} foot={`${counted.length} confirmed decisions`}/><Kpi title="Pending review" value={pending} icon={FileImage} foot={`${verified} verified gear records`}/></section>
          <div className="dashboard-grid"><section className="panel"><div className="panel-title"><div><h2>Operations queue</h2><p>What needs attention next</p></div><Sparkles size={19}/></div><div className="queue">
            <button onClick={()=>go('Evidence')}><div className="queue-icon purple"><FileImage size={18}/></div><span><b>Verify screenshots</b><small>Review and confirm imported evidence</small></span><strong>{pending}</strong></button>
            <button onClick={()=>go('Members')}><div className="queue-icon blue"><Users size={18}/></div><span><b>Guild roster</b><small>Add new players and check current roles</small></span><strong>{data.Members.length}</strong></button>
            <button onClick={()=>go('Gear')}><div className="queue-icon yellow"><Swords size={18}/></div><span><b>Gear history</b><small>Track dated equipment slot changes</small></span><strong>{data.Gear.length}</strong></button>
          </div></section>
          <section className="panel"><div className="panel-title"><div><h2>Attendance breakdown</h2><p>Only recorded decisions are included</p></div><ClipboardCheck size={19}/></div><div className="breakdown">{['Present','Late','Absent','Excused','Unconfirmed'].map(s=>{const c=data.Attendance.filter(a=>a['Attendance Status']===s).length;return <div className="breakdown-row" key={s}><div><span>{s}</span><b>{c}</b></div><div className="track"><div className={`bar ${normal(s)}`} style={{width:`${data.Attendance.length?100*c/data.Attendance.length:0}%`}}/></div></div>;})}</div></section></div>
          <section className="panel howto"><div className="panel-title"><div><h2>Getting started</h2><p>No invented sample data—start with actual guild screenshots and records.</p></div><FileSpreadsheet size={19}/></div><div className="steps"><div><b>01</b><span>Create guild member profiles</span><small>Roster → class, role and build</small></div><div><b>02</b><span>Log events and check-ins</span><small>Events → Attendance</small></div><div><b>03</b><span>Verify gear and results</span><small>Evidence → Equipment / Performance</small></div><div><b>04</b><span>Download your Excel</span><small>Export .xlsx for backup or sharing</small></div></div></section>
        </>:<>
          {isAdding&&<section className="panel formpanel"><div className="panel-title"><div><h2>{editing?'Edit':'New'} {page==='Members'?'member':page==='Gear'?'gear snapshot':page.toLowerCase()+' record'}</h2><p>Evidence-derived values should be checked before marking verified.</p></div><button className="iconbtn" onClick={cancelAdd} aria-label="Close form"><X size={18}/></button></div>
            <form onSubmit={e=>{e.preventDefault();void submit();}}><div className="formgrid">{DEF[page].fields.map(f=><label key={f.key} className={f.type==='textarea'?'wide':''}><span>{f.label}{f.required&&<em> *</em>}</span>{field(f)}</label>)}
              {page==='Evidence'&&<label className="wide file-upload"><span>Screenshot image (optional; stored only in this browser)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0]||null;setScreenshot(file);if(preview)URL.revokeObjectURL(preview);setPreview(file?URL.createObjectURL(file):null);if(file)setForm(o=>({...o,Filename:file.name}));}}/>{preview&&<img src={preview} alt="Screenshot preview"/>}</label>}
            </div><div className="form-actions"><button type="button" className="btn secondary" onClick={cancelAdd}>Cancel</button><button type="submit" className="btn primary"><CheckCircle2 size={16}/>{editing?'Save changes':'Save record'}</button></div></form>
          </section>}
          <section className="panel data-panel"><div className="table-top"><div><h2>{page==='Members'?'Member registry':page==='Gear'?'Gear log':page+' log'} <span className="count">{data[page].length}</span></h2><p>{page==='Gear'?'Latest snapshots appear first; keep all earlier records.':page==='Attendance'?'Do not treat blank/unrecorded entries as absences.':'Search and inspect stored entries.'}</p></div><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={`Search ${page.toLowerCase()}…`}/></div></div>
            <div className="table-wrap"><table><thead><tr>{HEADERS[page].map(h=><th key={h}>{h}</th>)}{page==='Evidence'&&<th>Image</th>}<th>Actions</th></tr></thead><tbody>
              {rows.length===0?<tr><td colSpan={HEADERS[page].length+(page==='Evidence'?2:1)} className="empty"><div className="empty-icon"><FileSpreadsheet size={26}/></div><strong>{query?'No matching records':'No records yet'}</strong><p>{query?'Try a different search.':'Add a record or import your prepared Excel workbook.'}</p></td></tr>:
                rows.map(row=><tr key={row[DEF[page].idKey]}>{HEADERS[page].map(h=><td key={h}>{displayCell(row,h)}</td>)}{page==='Evidence'&&<td><button className="mini" onClick={()=>void viewScreenshot(row['Evidence ID'])}>View image</button></td>}<td><div className="table-actions"><button className="mini" onClick={()=>startEdit(row)}>Edit</button><button className="iconbtn danger" onClick={()=>void remove(row)} title="Delete record" aria-label="Delete record"><Trash2 size={15}/></button></div></td></tr>)
              }
            </tbody></table></div>
          </section>
        </>}
        <footer><span>TNW Guild Operations · Clerk workspace</span><span>Excel export preserves structured data, not screenshot image files. <ChevronDown size={12}/></span></footer>
      </main>
    </div>
    {viewer&&<div className="viewer-backdrop" role="dialog" aria-modal="true" aria-label="Screenshot evidence" onClick={()=>{URL.revokeObjectURL(viewer);setViewer(null);}}><div className="viewer-card" onClick={e=>e.stopPropagation()}><div className="viewer-head"><b>Screenshot evidence</b><button className="iconbtn" aria-label="Close screenshot" onClick={()=>{URL.revokeObjectURL(viewer);setViewer(null);}}><X size={18}/></button></div><img src={viewer} alt="Guild screenshot evidence"/></div></div>}
  </div>;
}
