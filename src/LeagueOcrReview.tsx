import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { matchRosterIdentity, type RosterIdentity } from './lib/mirror-ocr';
import { readMirrorScreenshotWithTesseract, verifyMirrorScreenshot } from './lib/tesseract-reader';
import { uploadMirrorEvidence } from './lib/mirror-evidence';
import { leagueFieldSets, parseLeagueTabText, validLeagueField,
  type LeagueBattlefield, type LeagueTab } from './lib/league-ocr';

type Existing={memberId:string;battlefield:LeagueBattlefield;tab:LeagueTab};
type Proposed={
  key:number;detectedName:string;sourceLine:string;visibleRank:number|null;
  memberId:string;selected:boolean;matchStatus:string;
  values:Record<string,string>;warnings:string[];
};
type Props={
  matchId:string;existing:Existing[];onExpired:()=>void;onSaved:()=>Promise<void>|void
};
const root='/api/management/league';
function message(error:unknown){return error instanceof Error?error.message:'Unable to read screenshot';}

export function LeagueOcrReview({matchId,existing,onExpired,onSaved}:Props){
  const [roster,setRoster]=useState<RosterIdentity[]>([]);
  const fileInput=useRef<HTMLInputElement|null>(null);
  const [battlefield,setBattlefield]=useState<LeagueBattlefield>('MAIN');
  const [tab,setTab]=useState<LeagueTab>('DPS');
  const [file,setFile]=useState<File|null>(null);
  const [imageUrl,setImageUrl]=useState('');
  const [rawText,setRawText]=useState('');
  const [reference,setReference]=useState('');
  const [enhance,setEnhance]=useState(true);
  const [candidates,setCandidates]=useState<Proposed[]>([]);
  const [approved,setApproved]=useState(false);
  const [busy,setBusy]=useState(false);
  const [progress,setProgress]=useState<number|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let active=true;
    void fetch('/api/management/mirror-world/roster-index',{
      credentials:'same-origin',cache:'no-store'
    }).then(async res=>{
      if(res.status===401)onExpired();
      if(!res.ok)throw new Error('Could not load verified roster and aliases');
      return res.json() as Promise<{members:RosterIdentity[]}>;
    }).then(data=>{if(active)setRoster(data.members);})
      .catch(e=>{if(active)setError(message(e));});
    return()=>{active=false;};
  },[onExpired]);

  useEffect(()=>{
    if(!file){setImageUrl('');return;}
    const url=URL.createObjectURL(file);
    setImageUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  const fields=leagueFieldSets[tab];
  const selected=candidates.filter(row=>row.selected);
  const existingIds=useMemo(()=>new Set(existing.filter(row=>
    row.battlefield===battlefield&&row.tab===tab).map(row=>row.memberId)
  ),[existing,battlefield,tab]);
  const duplicates=useMemo(()=>{
    const seen=new Set<string>(),collisions=new Set<string>();
    for(const row of selected){
      if(!row.memberId)continue;
      if(seen.has(row.memberId))collisions.add(row.memberId);
      seen.add(row.memberId);
    }
    return collisions;
  },[selected]);
  const invalid=selected.filter(row=>!row.memberId||existingIds.has(row.memberId)||
    !fields.some(field=>(row.values[field.key]??'').trim()!=='')||
    fields.some(field=>!validLeagueField((row.values[field.key]??'').trim(),field.kind)));
  const canCommit=approved&&!busy&&selected.length>0&&selected.length<=50&&
    !duplicates.size&&!invalid.length&&(!!file||reference.trim().length>=3)&&
    (reference.trim().length===0||reference.trim().length>=3);

  function resetCapture(){
    if(fileInput.current)fileInput.current.value='';
    setFile(null);setRawText('');setReference('');setCandidates([]);
    setApproved(false);setError('');setNotice('');setProgress(null);
  }
  function setRow(key:number,change:Partial<Proposed>){
    setCandidates(old=>old.map(row=>row.key===key?{...row,...change}:row));
    setApproved(false);
  }
  function setMetric(key:number,field:string,value:string){
    setCandidates(old=>old.map(row=>row.key===key?{
      ...row,values:{...row.values,[field]:value}
    }:row));
    setApproved(false);
  }

  async function recognize(){
    if(!file)return;
    setBusy(true);setProgress(0);setError('');setNotice('');setApproved(false);
    try{
      const result=await readMirrorScreenshotWithTesseract(file,{
        enhanceContrast:enhance,onProgress:setProgress
      });
      if(!result.text.trim())throw new Error('No text was recognized. Try changing contrast or paste text from a trusted local tool.');
      setRawText(result.text);setCandidates([]);
      setNotice('OCR text captured locally. Engine confidence '+(result.confidence??'unknown')+
        '% is NOT field accuracy. Correct text and select Parse candidates.');
    }catch(e){setError(message(e));}
    finally{setBusy(false);setProgress(null);}
  }
  function parse(){
    setError('');setNotice('');setApproved(false);
    const data=parseLeagueTabText(rawText,tab);
    if(!data.length){
      setCandidates([]);
      setError('No complete candidate rows detected. The layout may be cropped or wrapped. Correct/paste text or use the manual League form.');
      return;
    }
    setCandidates(data.map((candidate,key)=>{
      const match=matchRosterIdentity(candidate.detectedName,roster);
      return {key,detectedName:candidate.detectedName,sourceLine:candidate.sourceLine,
        visibleRank:candidate.visibleRank,
        memberId:match.memberId??'',matchStatus:match.status,selected:false,
        values:candidate.values,warnings:candidate.warnings};
    }));
    setNotice('Candidates are UNSELECTED. Verify the screenshot tab, member, metric order and numbers before approving.');
  }

  async function submit(e:FormEvent){
    e.preventDefault();
    if(!canCommit)return;
    setBusy(true);setError('');setNotice('');
    try{
      const evidence=file?await uploadMirrorEvidence(file,onExpired):null;
      const sourceReference=(reference.trim()||evidence?.originalName||'').slice(0,255);
      if(sourceReference.length<3)throw new Error('Source reference must contain at least 3 characters');
      const rows=selected.map(row=>({
        memberId:row.memberId,reviewed:true,
        metrics:Object.fromEntries(fields.map(field=>{
          const raw=(row.values[field.key]??'').trim();
          return [field.key,raw===''?null:field.kind==='count'?Number(raw):raw];
        }))
      }));
      const response=await fetch(`${root}/matches/${matchId}/tab-results/batch`,{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({battlefield,tab,sourceReference,
          evidenceUploadId:evidence?.id??null,reviewed:true,rows})
      });
      if(response.status===401)onExpired();
      const data=await response.json().catch(()=>({})) as {created?:number;error?:string};
      if(!response.ok||typeof data.created!=='number')
        throw new Error(data.error||'League batch was not saved');
      await onSaved();
      resetCapture();
      setNotice(`Saved ${data.created} reviewed ${battlefield}/${tab} rows. Unselected OCR data was discarded.`);
    }catch(e){setError(message(e));}
    finally{setBusy(false);}
  }

  return <section className="roster-card league-ocr">
    <header className="league-ocr-head">
      <div><h2>Guild League screenshot import</h2>
        <p className="roster-note">Experimental, uncalibrated OCR: choose the exact battlefield and screenshot tab, read locally, then review every column before import. Player damage is a TOTAL, not DPS.</p></div>
      <strong>HUMAN REVIEW REQUIRED</strong>
    </header>
    {error&&<p role="alert" className="phase-error">{error}</p>}
    {notice&&<p role="status" className="phase-success">{notice}</p>}
    <div className="league-ocr-context">
      <label>Battlefield<select value={battlefield} disabled={busy}
        onChange={e=>{setBattlefield(e.target.value as LeagueBattlefield);setTab('DPS');resetCapture();}}>
        <option value="MAIN">Main</option><option value="SUB">Sub</option></select></label>
      <label>Screenshot tab<select value={tab} disabled={busy}
        onChange={e=>{setTab(e.target.value as LeagueTab);resetCapture();}}>
        <option value="DPS">DPS — cumulative damage</option>
        <option value="SUPPORT">Support</option>
        {battlefield==='SUB'&&<option value="STRATEGY">Strategy (Sub only)</option>}
      </select></label>
    </div>
    <div className="league-ocr-context">
      <div className="league-ocr-input">
        <label>Original screenshot (JPEG/PNG/WebP, max 5 MB)
          <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy}
            onChange={e=>{
              const selectedFile=e.target.files?.[0]??null;
              try{if(selectedFile)verifyMirrorScreenshot(selectedFile);
                setFile(selectedFile);setError('');
              }catch(err){setFile(null);setError(message(err));}
              setCandidates([]);setRawText('');setReference('');setApproved(false);
            }}/></label>
        {imageUrl&&<img src={imageUrl} className="league-ocr-preview"
          alt="Local Guild League screenshot to compare with OCR candidates"/>}
        <label className="league-ocr-check"><input type="checkbox" checked={enhance}
          disabled={busy} onChange={e=>setEnhance(e.target.checked)}/>
          Increase contrast for local OCR</label>
        <button type="button" disabled={!file||busy} onClick={()=>void recognize()}>
          {busy?'Recognizing…':'Read screenshot locally with Tesseract'}
        </button>
        {busy&&<p role="status">Recognizing screenshot locally · {progress??0}%</p>}
        <p className="roster-note">Image bytes remain on your device during OCR. An approved import optionally uploads one private copy with seven-day retention.</p>
      </div>
      <div className="league-ocr-input">
        <label>Extracted text (editable or paste from a trusted local OCR tool)
          <textarea rows={8} maxLength={20000} value={rawText}
            placeholder={'1 CharacterName 8 12 18.8B 1.2M\n2 AnotherName 3 4 5.4B 800M'}
            onChange={e=>{setRawText(e.target.value);setCandidates([]);setApproved(false);}}/>
        </label>
        <button type="button" disabled={!rawText.trim()||busy} onClick={parse}>
          Parse candidate rows
        </button>
        <label>Source reference (required when no image is selected)
          <input value={reference} maxLength={255}
            placeholder="league-main-dps-screen1.png"
            onChange={e=>{setReference(e.target.value);setApproved(false);}}/>
        </label>
        <small>Expected metric order: {fields.map(f=>f.label).join(' | ')}. An OCR line needs a name and four columns; rows with wrapped/missing columns may be skipped.</small>
      </div>
    </div>
    {!!candidates.length&&<form className="league-ocr-form" onSubmit={e=>void submit(e)}>
      <h3>Candidate review — {battlefield} / {tab}</h3>
      <p className="roster-note">All rows start unchecked. An exact alias is only a suggestion. Verify the source image and adjust fields; no fuzzy name matching or invisible-player inference.</p>
      <div className="league-ocr-scroll"><table>
        <thead><tr><th>Include</th><th>OCR player</th><th>Verified member</th>
          {fields.map(field=><th key={field.key}>{field.label}</th>)}<th>Warnings</th></tr></thead>
        <tbody>{candidates.map(row=><tr key={row.key}>
          <td><input type="checkbox" checked={row.selected}
            aria-label={`Include candidate ${row.key+1}`}
            onChange={e=>setRow(row.key,{selected:e.target.checked})}/></td>
          <td>{row.detectedName}<small className="league-ocr-source-line">{row.sourceLine}</small>
            <small>{row.visibleRank===null?'Rank not read':`Rank #${row.visibleRank}`}</small>
            <small>{row.matchStatus==='EXACT'?'Exact roster match suggested':row.matchStatus==='AMBIGUOUS'?'Ambiguous alias':'Unmatched player'}</small></td>
          <td><select value={row.memberId} aria-label={`Member for row ${row.key+1}`}
            onChange={e=>setRow(row.key,{memberId:e.target.value})}>
            <option value="">Select guild member</option>
            {roster.map(member=><option key={member.id} value={member.id}>
              {member.characterName}{member.memberStatus==='LEFT'?' (Left)':''}
            </option>)}
          </select></td>
          {fields.map(field=><td key={field.key}><input
            aria-label={`${field.label} for row ${row.key+1}`}
            type="text" maxLength={32} value={row.values[field.key]??''}
            onChange={e=>setMetric(row.key,field.key,e.target.value)}/>
          </td>)}
          <td><small>{row.warnings.join('; ')||'Compare source'}</small></td>
        </tr>)}</tbody>
      </table></div>
      {!!duplicates.size&&<p className="phase-error">Duplicate member selected for this screenshot tab. Resolve overlapping or repeated rows.</p>}
      {!!invalid.length&&<p className="phase-error">Selected rows contain an existing member/tab record, unverified member, invalid field, or no visible metrics. Correct or deselect them.</p>}
      <label className="league-ocr-approve"><input type="checkbox" checked={approved}
        onChange={e=>setApproved(e.target.checked)}/>
        I personally verified the match, battlefield, tab, member identity, all selected values and their units against the original screenshot.
      </label>
      <button className="roster-primary" disabled={!canCommit}>
        {busy?'Saving…':`Save ${selected.length} reviewed rows`}
      </button>
    </form>}
  </section>;
}
