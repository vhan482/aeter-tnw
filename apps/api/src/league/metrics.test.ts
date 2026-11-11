import assert from 'node:assert/strict';
import test from 'node:test';
import {mergeLeagueRows,leagueMetricLabels,type LeagueTabRow} from './metrics.js';

const make=(battlefield:'MAIN'|'SUB',tab:'DPS'|'SUPPORT'|'STRATEGY',
  memberId:string,metrics:LeagueTabRow['metrics']):LeagueTabRow=>({
  id:crypto.randomUUID(),battlefield,tab,memberId,
  characterName:memberId==='a'?'Alias A':'Alias B',metrics,
  sourceReference:'synthetic-test.png',evidenceUploadId:null,
  reviewedAt:new Date('2026-11-11T00:00:00Z'),version:1
});

test('League: merge DPS and Support by stable member and battlefield, not tab sort order',()=>{
  const merged=mergeLeagueRows([
    make('MAIN','DPS','a',{kills:2,assists:4,playerDamageRaw:'10.5B',buildingDamageRaw:null}),
    make('MAIN','DPS','b',{kills:1,assists:null,playerDamageRaw:'2M',buildingDamageRaw:'0'}),
    make('MAIN','SUPPORT','b',{deaths:0,revives:5,healingRaw:'8.4M',damageTakenRaw:'4M'}),
    make('MAIN','SUPPORT','a',{deaths:3,revives:0,healingRaw:null,damageTakenRaw:'1.2M'})
  ]);
  assert.equal(merged.length,2);
  assert.equal(merged[0].memberId,'a');
  assert.equal(merged[0].deaths,3);
  assert.equal(merged[0].kills,2);
  assert.equal(merged[0].totalPlayerDamageEstimate,'10500000000');
  assert.equal(merged[0].totalBuildingDamageEstimate,null);
  assert.equal(merged[1].deaths,0);
  assert.equal(merged[1].totalBuildingDamageEstimate,'0');
  assert.equal(merged[1].healingEstimate,'8400000');
});

test('League: one guild player across Main and Sub stays two independent records',()=>{
  const merged=mergeLeagueRows([
    make('MAIN','DPS','a',{kills:1}),
    make('SUB','DPS','a',{kills:3}),
    make('SUB','STRATEGY','a',{flagRepairs:2,bossDamageRaw:'1.5B'})
  ]);
  assert.equal(merged.length,2);
  assert.equal(merged[0].kills,1);
  assert.equal(merged[0].strategy,null);
  assert.equal(merged[1].kills,3);
  assert.equal(merged[1].bossDamageEstimate,'1500000000');
  assert.equal(merged[1].strategy?.metrics.flagRepairs,2);
});

test('League: no fabricated rows and reject duplicate tab identities',()=>{
  assert.deepEqual(mergeLeagueRows([]),[]);
  assert.throws(()=>mergeLeagueRows([
    make('MAIN','DPS','a',{kills:1}),make('MAIN','DPS','a',{kills:2})
  ]));
  assert.throws(()=>mergeLeagueRows([make('MAIN','STRATEGY','a',{flagRepairs:1})]));
  assert.deepEqual(leagueMetricLabels('DPS'),
    ['kills','assists','playerDamageRaw','buildingDamageRaw']);
});
