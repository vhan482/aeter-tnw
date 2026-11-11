import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { matchRosterIdentity, parseMirrorLeaderboardText,
  readScreenshotWithNativeOcr, type RosterIdentity } from './lib/mirror-ocr';
import { uploadMirrorEvidence } from './lib/mirror-evidence';

type SavedRow={memberId:string;rank:number|null};
type ProposedRow={
  key:number;name:string;memberId:string;rank:string;damageRaw:string;
  selected:boolean;warnings:string[];matchStatus:string
};
type Props={
  sessionId:string;existing:SavedRow[];onExpired:()=>void;
  onSaved:()=>Promise<void>|void
};
const base='/api/management/mirror-world';
function message(error:unknown){return error instanceof Error?error.message:'Unable to process screenshot';}
function selectedRows(rows:ProposedRow[]){return rows.filter(row=>row.selected);}

export function MirrorOcrReview({sessionId,existing,onExpired,onSaved}:Props){
  const [roster,setRoster]=useState<RosterIdentity[]>([]);
  const [file,setFile]=useState<File|null>(null);
  const [imageUrl,setImageUrl]=useState('');
  const [rawText,setRawText]=useState('');
  const [source,setSource]=useState('');
  const [rows,setRows]=useState<ProposedRow[]>([]);
  const [ack,setAck]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    let active=true;
    void fetch(base+'/roster-index',{credentials:'same-origin',cache:'no-store'})
      .then(async res=>{
        if(res.status===401)onExpired();
        if(!res.ok)throw new Error('Could not load canonical member and alias index');
        return res.json() as Promise<{members:RosterIdentity[]}>;
      })
      .then(r=>{if(active)setRoster(r.members);})
      .catch(e=>{if(active)setError(message(e));});
    return()=>{active=false;};
  },[onExpired]);

  useEffect(()=>{
    if(!file){setImageUrl('');return;}
    const url=URL.createObjectURL(file);setImageUrl(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  useEffect(()=>{setRows([]);setAck(false);setNotice('');setError('');},[sessionId]);

  const approved=selectedRows(rows);
  const duplicates=useMemo(()=>{
    const seen=new Set<string>(),repeat=new Set<string>();
    const rankSeen=new Set<string>(),rankRepeat=new Set<string>();
    for(const row of approved){
      if(row.memberId){if(seen.has(row.memberId))repeat.add(row.memberId);seen.add(row.memberId);}
      if(row.rank.trim()){if(rankSeen.has(row.rank))rankRepeat.add(row.rank);rankSeen.add(row.rank);}
    }
    return {members:repeat,ranks:rankRepeat};
  },[approved]);
  const existingIds=new Set(existing.map(row=>row.memberId));
  const conflicting=approved.filter(row=>existingIds.has(row.memberId));
  const invalid=approved.filter(row=>!row.memberId||!row.damageRaw.trim()||
    (row.rank.trim()&&(!Number.isInteger(Number(row.rank))||Number(row.rank)<1||Number(row.rank)>500)));
  const canCommit=approved.length>0 && approved.length<=50 && !invalid.length &&
    !duplicates.members.size && !duplicates.ranks.size && !conflicting.length && ack && !busy &&
    (Boolean(file)||source.trim().length>=3);

  function setCandidate(key:number,values:Partial<ProposedRow>){
    setRows(old=>old.map(row=>row.key===key?{...row,...values}:row));
    setAck(false);
  }

  async function recognize(){
    if(!file){setError('Choose an in-game screenshot first');return;}
    setBusy(true);setError('');setNotice('');
    try{
      const output=await readScreenshotWithNativeOcr(file);
      if(!output.trim())throw new Error('No readable text found. Use a clearer screenshot or paste extracted text.');
      setRawText(output);setRows([]);setAck(false);
      setNotice('Device OCR returned candidate text. Inspect it and select Parse text; do not treat it as verified.');
    }catch(e){setError(message(e));}
    finally{setBusy(false);}
  }

  function parseText(){
    setError('');setNotice('');setAck(false);
    const parsed=parseMirrorLeaderboardText(rawText);
    if(!parsed.length){setRows([]);setError('No candidate rank/name/damage rows found. Correct OCR text or use manual entry below.');return;}
    setRows(parsed.map((candidate,key)=>{
      const match=matchRosterIdentity(candidate.detectedName,roster);
      return {
        key,name:candidate.detectedName,memberId:match.memberId??'',
        rank:candidate.rank===null?'':String(candidate.rank),damageRaw:candidate.damageRaw,
        selected:false,matchStatus:match.status,warnings:candidate.warnings
      };
    }));
    setNotice('Candidate rows parsed. Select and review only values visible in the original image.');
  }

  async function commit(e:FormEvent){
    e.preventDefault();if(!canCommit)return;
    setBusy(true);setError('');setNotice('');
    try{
      const evidence=file?await uploadMirrorEvidence(file,onExpired):null;
      const ref=(source.trim()||evidence?.originalName||'').slice(0,255);
      const body={reviewed:true,rows:approved.map(row=>({
        memberId:row.memberId,rank:row.rank.trim()?Number(row.rank):null,
        damageRaw:row.damageRaw.trim(),sourceReference:ref,
        evidenceUploadId:evidence?.id??null,reviewed:true
      }))};
      const response=await fetch(base+'/sessions/'+sessionId+'/results/batch',{
        method:'POST',credentials:'same-origin',cache:'no-store',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      if(response.status===401)onExpired();
      const result=await response.json().catch(()=>({})) as {created?:number;error?:string};
      if(!response.ok||typeof result.created!=='number')
        throw new Error(result.error||'Reviewed results were not saved');
      await onSaved();
      setRows([]);setAck(false);setRawText('');setFile(null);setSource('');
      setNotice(`Saved ${result.created} reviewed Mirror World results. Unselected OCR rows were discarded.`);
    }catch(e){setError(message(e));}
    finally{setBusy(false);}
  }

  return <section className="roster-card mirror-ocr">
    <header className="mirror-ocr-header"><div>
      <h2>Screenshot reader & batch review</h2>
      <p className="roster-note">Experimental on-device detection where your browser supports it. No automatic database writes. Unsupported browsers can paste text produced by a trusted local OCR tool.</p>
    </div><span className="mirror-ocr-label">HUMAN REVIEW REQUIRED</span></header>
    {error&&<p role="alert" className="phase-error">{error}</p>}
    {notice&&<p role="status" className="phase-success">{notice}</p>}
    <div className="mirror-ocr-layout">
      <div className="mirror-ocr-input">
        <label>In-game leaderboard screenshot (PNG/JPEG/WebP, up to 5 MB)
          <input type="file" accept="image/png,image/jpeg,image/webp"
            onChange={e=>{
              setFile(e.target.files?.[0]??null);setRows([]);setAck(false);setError('');setNotice('');
            }}/></label>
        {imageUrl&&<img className="mirror-ocr-preview" src={imageUrl} alt="Local selected Mirror World ranking screenshot" />}
        <button type="button" disabled={!file||busy} onClick={()=>void recognize()}>
          {busy?'Processing…':'Try on-device text recognition'}
        </button>
        <p className="roster-note">Only locally detected text is proposed here. The image is uploaded to private server storage only if you approve and save results.</p>
      </div>
      <div className="mirror-ocr-input">
        <label>Detected text (editable; paste local OCR output if needed)
          <textarea value={rawText} rows={8} maxLength={20000}
            placeholder={'1 ExamplePlayer 18.8B\n2 AnotherPlayer 14.3B'}
            onChange={e=>{setRawText(e.target.value);setRows([]);setAck(false);}}/>
        </label>
        <button type="button" disabled={!rawText.trim()||busy} onClick={parseText}>
          Parse leaderboard candidates
        </button>
        <label>Source reference (optional when image selected)
          <input value={source} maxLength={255} placeholder="mirror-world-page1.png"
            onChange={e=>{setSource(e.target.value);setAck(false);}}/>
        </label>
      </div>
    </div>
    {!!rows.length&&<form className="mirror-ocr-review" onSubmit={e=>void commit(e)}>
      <h3>Detected candidates — select only rows you verified</h3>
      <p className="roster-note">Exact name/alias matches are suggestions only. OCR can confuse names, ranks, zeros and suffixes; check the original image. Missing ranks stay unknown.</p>
      <div className="mirror-ocr-scroll"><table>
        <thead><tr><th>Include</th><th>Read name</th><th>Match member</th><th>Rank</th><th>Displayed damage</th><th>Flags</th></tr></thead>
        <tbody>{rows.map(row=><tr key={row.key}>
          <td><input type="checkbox" aria-label={`Include row ${row.key+1}`}
            checked={row.selected} onChange={e=>setCandidate(row.key,{selected:e.target.checked})}/></td>
          <td>{row.name}<small>{row.matchStatus==='EXACT'?'Exact name or alias':row.matchStatus==='AMBIGUOUS'?'Ambiguous name':'Unmatched name'}</small></td>
          <td><select aria-label={`Member for row ${row.key+1}`} value={row.memberId}
            onChange={e=>setCandidate(row.key,{memberId:e.target.value})}>
            <option value="">Select verified member</option>
            {roster.map(m=><option key={m.id} value={m.id}>{m.characterName}{m.memberStatus==='LEFT'?' (Left)':''}</option>)}
          </select></td>
          <td><input aria-label={`Rank for row ${row.key+1}`} type="number" min={1} max={500}
            value={row.rank} onChange={e=>setCandidate(row.key,{rank:e.target.value})}/></td>
          <td><input aria-label={`Damage for row ${row.key+1}`} maxLength={32} required={row.selected}
            value={row.damageRaw} onChange={e=>setCandidate(row.key,{damageRaw:e.target.value})}/></td>
          <td><small>{row.warnings.join('; ')||'Review required'}</small></td>
        </tr>)}</tbody>
      </table></div>
      {!!duplicates.members.size&&<p className="phase-error">Two selected rows resolve to the same member. Uncheck or correct duplicates.</p>}
      {!!duplicates.ranks.size&&<p className="phase-error">Selected results contain a repeated rank.</p>}
      {!!conflicting.length&&<p className="phase-error">One or more selected members already have a saved result for this session.</p>}
      {!!invalid.length&&<p className="phase-error">Selected rows need valid members, rank (or blank) and damage.</p>}
      <label className="mirror-review"><input type="checkbox" checked={ack}
        onChange={e=>setAck(e.target.checked)}/>
        I compared all selected rows against the original screenshot and confirmed their member identities and values.
      </label>
      <button className="roster-primary" disabled={!canCommit}>
        {busy?'Saving…':`Save ${approved.length} reviewed row(s)`}
      </button>
    </form>}
  </section>;
}
