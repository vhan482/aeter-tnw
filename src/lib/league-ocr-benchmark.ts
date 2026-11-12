import { normalizeOcrName } from './mirror-ocr';
import { leagueFieldSets, parseLeagueTabText, type LeagueTab } from './league-ocr';

export type LeagueVerifiedRow={
  name:string;
  /** Null means the reviewer cannot verify this cell from the screenshot. */
  values:Record<string,string|null>;
};

export type LeagueBenchmarkIssue={
  kind:'MISSING_ROW'|'EXTRA_OCR_ROW'|'DUPLICATE_OCR_NAME'|'FIELD_MISMATCH';
  name:string;
  field?:string;
  expected?:string;
  observed?:string;
};

export type LeagueFieldScore={
  key:string;label:string;
  labeled:number;compared:number;correct:number;
  matchPercent:number|null;coveragePercent:number|null;
};

export type LeagueBenchmarkReport={
  version:1;tab:LeagueTab;
  evaluatedAt:string;
  sourceName:string|null;
  labeledRows:number;ocrCandidates:number;matchedRows:number;
  rowRecallPercent:number|null;candidatePrecisionPercent:number|null;
  fields:LeagueFieldScore[];
  totalLabeledCells:number;totalComparedCells:number;totalCorrectCells:number;
  comparedFieldAccuracyPercent:number|null;
  endToEndFieldCoveragePercent:number|null;
  issues:LeagueBenchmarkIssue[];
  limitations:string[];
};

function percent(numerator:number,denominator:number):number|null{
  return denominator===0?null:Math.round(numerator/denominator*10000)/100;
}
function canonicalDisplay(value:string):string{
  return value.normalize('NFKC').trim().replace(/[\s,]/g,'').toUpperCase();
}

/** Human-entered *ground truth* must be independent of the raw OCR text.
 * Format: Player name | metric 1 | metric 2 | metric 3 | metric 4
 * Use ? (or an empty cell) for unreadable / unverifiable metrics.
 * Do not treat an unknown value as a verified zero.
 */
export function parseLeagueVerifiedRows(
  input:string,tab:LeagueTab
):{rows:LeagueVerifiedRow[];errors:string[]}{
  const fields=leagueFieldSets[tab];
  const rows:LeagueVerifiedRow[]=[];
  const errors:string[]=[];
  const names=new Set<string>();
  const sourceLines=input.slice(0,25000).split(/\r?\n/).slice(0,250);
  for(const [index,raw] of sourceLines.entries()){
    const line=raw.normalize('NFKC').trim();
    if(!line||line.startsWith('#'))continue;
    const columns=line.split('|').map(part=>part.trim());
    if(columns.length!==fields.length+1){
      errors.push(`Line ${index+1}: expected a name and ${fields.length} pipe-separated metrics`);
      continue;
    }
    const [name,...values]=columns;
    if(!name||name.length>128){
      errors.push(`Line ${index+1}: missing or overlong verified name`);
      continue;
    }
    const key=normalizeOcrName(name);
    if(names.has(key)){
      errors.push(`Line ${index+1}: duplicate verified name; label each visible player once`);
      continue;
    }
    names.add(key);
    rows.push({name,values:Object.fromEntries(fields.map((field,i)=>{
      const value=values[i];
      return [field.key, !value||value==='?'||value==='—'||value==='-'?null:value];
    }))});
  }
  if(!rows.length)errors.push('Enter at least one independently verified screenshot row');
  return {rows,errors};
}

/** Strictly match OCR candidates to verified names. An OCR misspelling reduces
 * row recall; fuzzy matching must never inflate a claimed accuracy score.
 * Duplicated OCR names are ambiguous and cannot contribute scored cells.
 */
export function benchmarkLeagueOcr(
  tab:LeagueTab,
  rawOcrText:string,
  verifiedRows:LeagueVerifiedRow[],
  options:{sourceName?:string;at?:string}={}
):LeagueBenchmarkReport{
  const candidates=parseLeagueTabText(rawOcrText,tab);
  const truth=new Map<string,LeagueVerifiedRow>();
  for(const row of verifiedRows){
    const key=normalizeOcrName(row.name);
    if(!key||truth.has(key))throw new Error('Verified player names must be present and unique');
    truth.set(key,row);
  }
  const extracted=new Map<string,typeof candidates>();
  for(const item of candidates){
    const key=normalizeOcrName(item.detectedName);
    extracted.set(key,[...(extracted.get(key)??[]),item]);
  }
  const issues:LeagueBenchmarkIssue[]=[];
  let matchedRows=0;
  const fields=leagueFieldSets[tab].map(field=>{
    const labeled=verifiedRows.reduce((sum,row)=>
      sum+(row.values[field.key]===null||row.values[field.key]===undefined?0:1),0);
    return {...field,labeled,compared:0,correct:0};
  });
  for(const row of verifiedRows){
    const key=normalizeOcrName(row.name);
    const matches=extracted.get(key)??[];
    if(matches.length!==1){
      issues.push({kind:'MISSING_ROW',name:row.name});
      continue;
    }
    matchedRows++;
    const candidate=matches[0];
    for(const score of fields){
      const expected=row.values[score.key];
      if(expected===null||expected===undefined)continue;
      score.compared++;
      const observed=candidate.values[score.key]??'';
      if(canonicalDisplay(expected)===canonicalDisplay(observed))score.correct++;
      else issues.push({kind:'FIELD_MISMATCH',name:row.name,field:score.key,
        expected,observed});
    }
  }
  for(const [name,items] of extracted){
    if(items.length>1){
      issues.push({kind:'DUPLICATE_OCR_NAME',name:items[0].detectedName});
    }
    if(!truth.has(name)){
      for(const row of items){
        issues.push({kind:'EXTRA_OCR_ROW',name:row.detectedName});
      }
    }
  }
  const labeled=fields.reduce((sum,s)=>sum+s.labeled,0);
  const compared=fields.reduce((sum,s)=>sum+s.compared,0);
  const correct=fields.reduce((sum,s)=>sum+s.correct,0);
  const finalized=fields.map(({key,label,labeled,compared,correct})=>({
    key,label,labeled,compared,correct,
    matchPercent:percent(correct,compared),
    coveragePercent:percent(correct,labeled)
  }));
  return {
    version:1,tab,evaluatedAt:options.at??new Date().toISOString(),
    sourceName:options.sourceName??null,
    labeledRows:verifiedRows.length,ocrCandidates:candidates.length,matchedRows,
    rowRecallPercent:percent(matchedRows,verifiedRows.length),
    candidatePrecisionPercent:percent(matchedRows,candidates.length),
    fields:finalized,totalLabeledCells:labeled,totalComparedCells:compared,
    totalCorrectCells:correct,
    comparedFieldAccuracyPercent:percent(correct,compared),
    endToEndFieldCoveragePercent:percent(correct,labeled),
    issues,
    limitations:[
      'Measures existing four-column OCR text parser, not screenshot layout or worker runtime accuracy in isolation.',
      'Requires independently transcribed screenshot ground truth, never edited OCR output as the reference.',
      'Only exact normalized player names count as matched; misread names reduce recall.',
      'Unverifiable truth cells are excluded; missing result rows are not treated as zero.',
      'No measurements are meaningful until evaluated against authentic TNW Guild League screenshots.'
    ]
  };
}
