import { z } from 'zod';
import { parseDamageDisplay } from '../mirror/damage.js';

const uuid=z.string().uuid();
const positiveCount=z.number().int().min(0).max(2_000_000_000).nullable().default(null);
const sourceValue=z.string().trim().min(1).max(32)
  .refine(value=>parseDamageDisplay(value)!==null,'Invalid cumulative amount')
  .nullable().default(null);
const common={
  battlefield:z.enum(['MAIN','SUB']),
  memberId:uuid,sourceReference:z.string().trim().min(3).max(255),
  evidenceUploadId:uuid.nullable().default(null),
  reviewed:z.literal(true)
};
export const leagueObservation=z.discriminatedUnion('tab',[
  z.object({...common,tab:z.literal('DPS'),metrics:z.object({
    kills:positiveCount,assists:positiveCount,
    playerDamageRaw:sourceValue,buildingDamageRaw:sourceValue
  }).strict()}).strict(),
  z.object({...common,tab:z.literal('SUPPORT'),metrics:z.object({
    deaths:positiveCount,revives:positiveCount,
    healingRaw:sourceValue,damageTakenRaw:sourceValue
  }).strict()}).strict(),
  z.object({...common,tab:z.literal('STRATEGY'),metrics:z.object({
    // This screenshot heading was partially obscured: DO NOT label as a verified minion count.
    minionMetricRaw:sourceValue,flagRepairs:positiveCount,
    bossFinishers:positiveCount,bossDamageRaw:sourceValue
  }).strict()}).strict()
]).superRefine((value,ctx)=>{
  if(value.tab==='STRATEGY' && value.battlefield!=='SUB'){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['battlefield'],message:'Strategy is Sub-only'});
  }
  if(!Object.values(value.metrics).some(v=>v!==null && v!==undefined)){
    ctx.addIssue({code:z.ZodIssueCode.custom,path:['metrics'],message:'Review at least one visible metric'});
  }
});
export type LeagueObservationInput=z.infer<typeof leagueObservation>;
export function normalizedLeagueMetrics(input:LeagueObservationInput):Record<string,number|string|null>{
  return input.metrics;
}
