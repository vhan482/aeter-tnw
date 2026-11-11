/** Guild League OCR candidates are deliberately conservative.
 * No screenshot template has yet been benchmarked against genuine TNW images.
 * Field order MUST be confirmed by a human on every screenshot and tab.
 */
export type LeagueBattlefield = 'MAIN'|'SUB';
export type LeagueTab = 'DPS'|'SUPPORT'|'STRATEGY';
export type LeagueField = {key:string;label:string;kind:'count'|'amount'};

export const leagueFieldSets:Record<LeagueTab,readonly LeagueField[]>={
  DPS:[
    {key:'kills',label:'Kills',kind:'count'},
    {key:'assists',label:'Assists',kind:'count'},
    {key:'playerDamageRaw',label:'Total player damage (NOT DPS)',kind:'amount'},
    {key:'buildingDamageRaw',label:'Total building damage',kind:'amount'}],
  SUPPORT:[
    {key:'deaths',label:'Deaths',kind:'count'},
    {key:'revives',label:'Revives',kind:'count'},
    {key:'healingRaw',label:'Total healing',kind:'amount'},
    {key:'damageTakenRaw',label:'Total damage taken',kind:'amount'}],
  STRATEGY:[
    {key:'minionMetricRaw',label:'Minion-related metric (label unverified)',kind:'amount'},
    {key:'flagRepairs',label:'Flag repairs',kind:'count'},
    {key:'bossFinishers',label:'Boss finishers',kind:'count'},
    {key:'bossDamageRaw',label:'Total boss damage',kind:'amount'}]
};

export type LeagueOcrCandidate={
  sourceLine:string;
  detectedName:string;
  visibleRank:number|null;
  values:Record<string,string>;
  warnings:string[];
};

const amount=/^(?:(?:\d{1,3}(?:,\d{3})+)|(?:\d{1,15}))(?:\.\d{1,3})?\s*[KMBT]?$/i;
const count=/^\d{1,10}$/;
const missing=/^(?:-|—|–|N\/A|UNKNOWN|\?)$/i;

export function validLeagueField(value:string,kind:'count'|'amount'):boolean{
  if(value==='')return true; // unknown; do not silently convert to zero
  if(kind==='amount'){
    if(!amount.test(value)||value.length>32)return false;
    const clean=value.toUpperCase().replaceAll(',','').replace(/\s+/g,'');
    const match=/^(\d{1,15})(?:\.(\d{1,3}))?([KMBT]?)$/.exec(clean);
    if(!match)return false;
    const [,whole,decimal='',suffix]=match;
    const exponent:Record<string,number>={'':0,K:3,M:6,B:9,T:12};
    const order=exponent[suffix];
    if(decimal.length>order)return false;
    const scaled=BigInt(whole)*10n**BigInt(order)+
      (decimal?BigInt(decimal)*10n**BigInt(order-decimal.length):0n);
    return scaled<10n**24n; // Mirror/League database NUMERIC(24,0) invariant
  }
  if(!count.test(value))return false;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>=0&&number<=2_000_000_000;
}

/** Text already recognized locally by Tesseract or manually pasted.
 * Accept only lines with a name plus exactly four rightmost field tokens,
 * in the order of the selected screenshot tab. Spaces inside names survive.
 * Cropped, wrapped or misaligned rows may be skipped; nobody is inferred.
 */
export function parseLeagueTabText(text:string,tab:LeagueTab):LeagueOcrCandidate[]{
  const fields=leagueFieldSets[tab];
  const candidates:LeagueOcrCandidate[]=[];
  for(const input of text.slice(0,20000).split(/\r?\n/).slice(0,250)){
    const line=input.normalize('NFKC').replace(/\u00a0/g,' ').trim();
    if(!line||line.length>260)continue;
    const tokens=line.replace(/\s*\|\s*/g,' ').split(/\s+/).filter(Boolean);
    if(tokens.length<fields.length+1)continue;
    const tail=tokens.slice(-fields.length);
    const prefix=tokens.slice(0,-fields.length).join(' ');
    if(!prefix||prefix.length>128)continue;
    // Ignore common headers. OCR header mistakes may still appear as unchecked proposals.
    if(/^(?:rank|ranking|player|name|total|guild|battlefield|statistics)\b/i.test(prefix))
      continue;
    const rankMatch=/^(?:#\s*)?(\d{1,3})(?:[.)])?\s+(.+)$/u.exec(prefix);
    const rank=rankMatch?Number(rankMatch[1]):null;
    if(rank!==null &&(rank<1||rank>500))continue;
    const detectedName=(rankMatch?rankMatch[2]:prefix).trim();
    if(detectedName.length<1||detectedName.length>128)continue;
    const values:Record<string,string>={};
    const warnings:string[]=[];
    fields.forEach((field,i)=>{
      const raw=tail[i];
      values[field.key]=missing.test(raw)?'':raw;
      if(!validLeagueField(values[field.key],field.kind))
        warnings.push(`Check ${field.label}: ${raw}`);
    });
    if(rank===null)warnings.push('Visible rank unknown; rank is not used to match players');
    if(tail.some(t=>missing.test(t)))
      warnings.push('Missing values stay unknown, not zero');
    candidates.push({sourceLine:line,detectedName,visibleRank:rank,values,warnings});
    if(candidates.length>=100)break;
  }
  const names=new Map<string,number>();
  for(const candidate of candidates){
    const key=candidate.detectedName.normalize('NFKC').trim().toLocaleLowerCase();
    names.set(key,(names.get(key)??0)+1);
  }
  for(const candidate of candidates){
    const key=candidate.detectedName.normalize('NFKC').trim().toLocaleLowerCase();
    if((names.get(key)??0)>1)
      candidate.warnings.push('Repeated player name — overlapping screenshots or OCR duplication');
  }
  return candidates;
}
