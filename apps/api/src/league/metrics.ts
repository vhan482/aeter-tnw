import { parseDamageDisplay } from '../mirror/damage.js';

export type LeagueBattlefield='MAIN'|'SUB';
export type LeagueTab='DPS'|'SUPPORT'|'STRATEGY';
export type LeagueMetrics=Record<string,string|number|null>;
export type LeagueTabRow={
  id:string;memberId:string;characterName:string;
  battlefield:LeagueBattlefield;tab:LeagueTab;
  metrics:LeagueMetrics;sourceReference:string;
  evidenceUploadId:string|null;reviewedAt:Date;version:number;
};
export type LeagueConsolidated={
  battlefield:LeagueBattlefield;memberId:string;characterName:string;
  dps:LeagueTabRow|null;support:LeagueTabRow|null;strategy:LeagueTabRow|null;
  kills:number|null;assists:number|null;deaths:number|null;
  totalPlayerDamageEstimate:string|null;totalBuildingDamageEstimate:string|null;
  healingEstimate:string|null;damageTakenEstimate:string|null;
  bossDamageEstimate:string|null;
};

const DPS=['kills','assists','playerDamageRaw','buildingDamageRaw'] as const;
const SUPPORT=['deaths','revives','healingRaw','damageTakenRaw'] as const;
const STRATEGY=['minionMetricRaw','flagRepairs','bossFinishers','bossDamageRaw'] as const;

/** Values from different tabs are never matched by row position. The key
 * is (battlefield, guild member ID) within exactly one match.
 * A null metric means unseen/unknown; zero is explicitly verified zero.
 */
export function mergeLeagueRows(rows:LeagueTabRow[]):LeagueConsolidated[]{
  const merged=new Map<string,LeagueConsolidated>();
  for(const row of rows){
    if(row.tab==='STRATEGY' && row.battlefield!=='SUB')
      throw new Error('Strategy observation is only valid in the Sub battlefield');
    const key=row.battlefield+':'+row.memberId;
    let member=merged.get(key);
    if(!member){
      member={battlefield:row.battlefield,memberId:row.memberId,
        characterName:row.characterName,dps:null,support:null,strategy:null,
        kills:null,assists:null,deaths:null,totalPlayerDamageEstimate:null,
        totalBuildingDamageEstimate:null,healingEstimate:null,
        damageTakenEstimate:null,bossDamageEstimate:null};
      merged.set(key,member);
    }
    if(member[row.tab.toLowerCase() as 'dps'|'support'|'strategy'])
      throw new Error('Duplicate tab review for a battlefield/member');
    if(row.tab==='DPS'){
      member.dps=row;member.kills=metricInt(row.metrics,'kills');
      member.assists=metricInt(row.metrics,'assists');
      member.totalPlayerDamageEstimate=metricDamage(row.metrics,'playerDamageRaw');
      member.totalBuildingDamageEstimate=metricDamage(row.metrics,'buildingDamageRaw');
    } else if(row.tab==='SUPPORT'){
      member.support=row;member.deaths=metricInt(row.metrics,'deaths');
      member.healingEstimate=metricDamage(row.metrics,'healingRaw');
      member.damageTakenEstimate=metricDamage(row.metrics,'damageTakenRaw');
    } else {
      member.strategy=row;
      member.bossDamageEstimate=metricDamage(row.metrics,'bossDamageRaw');
    }
  }
  return [...merged.values()].sort((a,b)=>
    a.battlefield.localeCompare(b.battlefield)||
    a.characterName.localeCompare(b.characterName));
}
function metricInt(metrics:LeagueMetrics,key:string):number|null{
  const value=metrics[key];
  return typeof value==='number'&&Number.isSafeInteger(value)?value:null;
}
function metricDamage(metrics:LeagueMetrics,key:string):string|null{
  const value=metrics[key];
  return typeof value==='string'?parseDamageDisplay(value)?.normalized??null:null;
}

/** These field sets intentionally exclude unverified labels:
 * the game's 'DPS' tab does not represent a per-second rate, and the
 * obscured Sub minion heading is kept neutral as minionMetricRaw.
 */
export function leagueMetricLabels(tab:LeagueTab):readonly string[]{
  return tab==='DPS'?DPS:tab==='SUPPORT'?SUPPORT:STRATEGY;
}
