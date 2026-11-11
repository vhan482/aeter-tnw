import { estimateAverageDps } from './damage.js';

export type MirrorTrendSource = {
  sessionId:string;
  startsAt:Date;
  durationSeconds:number;
  rank:number|null;
  damageRaw:string;
  damageEstimate:string;
  approximate:boolean;
  sourceReference:string;
};

export type MirrorTrendPoint = MirrorTrendSource & {
  averageDpsEstimate:string;
  changeFromPreviousPercent:string|null;
  bestAmongDisplayed:boolean;
};

/** Compare rates exactly as rational numbers, not JS floats. The two totals
 * may be rounded screenshot values. NULL if previous baseline was zero.
 */
export function percentChangeInEstimatedDps(
  currentDamage:string,currentDuration:number,
  previousDamage:string,previousDuration:number
):string|null{
  if(!Number.isSafeInteger(currentDuration)||currentDuration<=0||
    !Number.isSafeInteger(previousDuration)||previousDuration<=0) {
    throw new Error('Invalid Mirror World duration');
  }
  const current=BigInt(currentDamage)*BigInt(previousDuration);
  const previous=BigInt(previousDamage)*BigInt(currentDuration);
  if(previous===0n)return null;
  const difference=current-previous;
  const absolute=difference<0n?-difference:difference;
  const hundredths=(absolute*10000n+previous/2n)/previous;
  const whole=hundredths/100n, fraction=(hundredths%100n).toString().padStart(2,'0');
  return (difference<0n?'-':difference>0n?'+':'')+`${whole}.${fraction}`;
}

/** Source rows must arrive oldest-first; no missing sessions or unseen player
 * rows are fabricated. The best is within the bounded display window only.
 */
export function buildMirrorTrends(rows:MirrorTrendSource[]):MirrorTrendPoint[]{
  let best:MirrorTrendSource|null=null;
  let bestIndex=-1;
  const result=rows.map((row,index)=>{
    const previous=index?rows[index-1]:null;
    if(!best||BigInt(row.damageEstimate)*BigInt(best.durationSeconds)>
      BigInt(best.damageEstimate)*BigInt(row.durationSeconds)){
      best=row;bestIndex=index;
    }
    return {...row,
      averageDpsEstimate:estimateAverageDps(row.damageEstimate,row.durationSeconds),
      changeFromPreviousPercent:previous?percentChangeInEstimatedDps(
        row.damageEstimate,row.durationSeconds,
        previous.damageEstimate,previous.durationSeconds):null,
      bestAmongDisplayed:false
    };
  });
  if(bestIndex>=0) result[bestIndex].bestAmongDisplayed=true;
  return result;
}
