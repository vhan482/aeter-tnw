import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { matchRosterIdentity, type RosterIdentity } from './lib/mirror-ocr';
import { benchmarkLeagueOcr, parseLeagueVerifiedRows, type LeagueBenchmarkReport } from './lib/league-ocr-benchmark';
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
  const [originalOcrText,setOriginalOcrText]=useState('');
  const [verifiedTruth,setVerifiedTruth]=useState('');
  const [benchmark,setBenchmark]=useState<LeagueBenchmarkReport|null>(null);
  const [benchmarkError,setBenchmarkError]=useState('');

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
    setOriginalOcrText('');setVerifiedTruth('');setBenchmark(null);setBenchmarkError('');
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
      setOriginalOcrText(result.text);
      setBenchmark(null);setBenchmarkError('');
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


  /** Use only immutable engine output, never edited candidate text, for scores.
   * The user independently transcribes ground truth from the original image.
   * All comparisons and report downloads remain local to this browser.
   */
  function runBenchmark(){
    setBenchmark(null);setBenchmarkError('');
    if(!file||!originalOcrText){
      setBenchmarkError('Read this screenshot with local Tesseract first, without editing the engine output.');
      return;
    }
    const truth=parseLeagueVerifiedRows(verifiedTruth,tab);
    if(truth.errors.length){
      setBenchmarkError(truth.errors.join(' · '));return;
    }
    try{
      setBenchmark(benchmarkLeagueOcr(tab,originalOcrText,truth.rows,{
        sourceName:file.name
      }));
    }catch(err){setBenchmarkError(message(err));}
  }
  function downloadBenchmark(){
    if(!benchmark)return;
    const payload={report:benchmark,originalOcrText,independentlyVerifiedRows:verifiedTruth};
    const content=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(content);
    const link=document.createElement('a');
    link.href=url;
    link.download=`aeternum-league-ocr-${tab.toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
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
              setOriginalOcrText('');setVerifiedTruth('');setBenchmark(null);setBenchmarkError('');
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

    <details className="league-ocr-calibration">
      <summary>OCR accuracy lab — compare against independently verified screenshot data</summary>
      <p className="roster-note">
        This optional local-only calibration does not save results or upload the screenshot.
        Use the original game screenshot to manually transcribe each visible player and its
        four fields. Do not copy or correct the OCR text to create the reference; that
        would inflate accuracy. Cropped or unreadable fields use ? rather than 0.
      </p>
      <label>Verified rows — one per line, separated with | (player name | 4 metrics)
        <textarea rows={6} value={verifiedTruth} maxLength={25000}
          placeholder={tab==='DPS'?
            'Alpha | 8 | 12 | 18.8B | 1.2M\\nBravo | 0 | 2 | 5B | ?':
            tab==='SUPPORT'?
              'Alpha | 3 | 2 | 8.4M | 4M':
              'Alpha | ? | 2 | 0 | 1.5B'}
          onChange={e=>{setVerifiedTruth(e.target.value);setBenchmark(null);setBenchmarkError('');}}/>
      </label>
      <p className="roster-note">Selected tab: <strong>{battlefield} / {tab}</strong>.
        Column order: {fields.map(field=>field.label).join(' | ')}.
        Only text captured by this screenshot's OCR run is used for scoring.
      </p>
      <button type="button" disabled={!originalOcrText||!verifiedTruth.trim()||busy}
        onClick={runBenchmark}>Compare original OCR with verified rows</button>
      {benchmarkError&&<p role="alert" className="phase-error">{benchmarkError}</p>}
      {benchmark&&<div className="league-ocr-report" role="status">
        <h3>Local accuracy report — not a production benchmark</h3>
        <p>Recognized player names: <strong>{benchmark.matchedRows}/{benchmark.labeledRows}</strong>
          {' '}({benchmark.rowRecallPercent??'—'}% recall); extra/unmatched OCR rows:
          {' '}{benchmark.ocrCandidates-benchmark.matchedRows}.
        </p>
        <p>Field accuracy among recognized names:
          {' '}<strong>{benchmark.comparedFieldAccuracyPercent??'—'}%</strong>
          {' '}({benchmark.totalCorrectCells}/{benchmark.totalComparedCells} evaluated cells).
          End-to-end field coverage:
          {' '}<strong>{benchmark.endToEndFieldCoveragePercent??'—'}%</strong>
          {' '}({benchmark.totalCorrectCells}/{benchmark.totalLabeledCells} verified cells).
        </p>
        <div className="league-ocr-scroll"><table>
          <thead><tr><th>Metric</th><th>Verified</th><th>Compared</th>
            <th>Correct</th><th>Matched-row accuracy</th><th>Overall coverage</th></tr></thead>
          <tbody>{benchmark.fields.map(score=><tr key={score.key}>
            <td>{score.label}</td><td>{score.labeled}</td>
            <td>{score.compared}</td><td>{score.correct}</td>
            <td>{score.matchPercent===null?'—':score.matchPercent+'%'}</td>
            <td>{score.coveragePercent===null?'—':score.coveragePercent+'%'}</td>
          </tr>)}</tbody>
        </table></div>
        {!!benchmark.issues.length&&<div className="league-ocr-issues">
          <h4>Detected discrepancies ({benchmark.issues.length})</h4>
          <ul>{benchmark.issues.slice(0,80).map((issue,index)=><li key={index}>
            <strong>{issue.kind}</strong>: {issue.name}
            {issue.field&&` / ${issue.field}`}
            {issue.expected!==undefined&&` · verified ${issue.expected}`}
            {issue.observed!==undefined&&` · OCR ${issue.observed||'missing'}`}
          </li>)}</ul>
        </div>}
        <p className="roster-note">This report compares unedited engine text to independent labels;
          it does not prove real-world accuracy from one screenshot.</p>
        <button type="button" onClick={downloadBenchmark}>
          Download local diagnostic JSON (includes player names and OCR text)
        </button>
      </div>}
    </details>
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
