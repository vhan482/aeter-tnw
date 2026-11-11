import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMirrorTrends, percentChangeInEstimatedDps,
  type MirrorTrendSource } from './insights.js';

test('Mirror World: same-boss approximate rate changes use exact integer math',()=>{
  assert.equal(percentChangeInEstimatedDps('20000000000',900,'18800000000',900),'+6.38');
  assert.equal(percentChangeInEstimatedDps('18800000000',900,'20000000000',900),'-6.00');
  assert.equal(percentChangeInEstimatedDps('18800000000',600,'18800000000',900),'+50.00');
  assert.equal(percentChangeInEstimatedDps('0',900,'0',900),null);
  assert.equal(percentChangeInEstimatedDps('100',900,'0',900),null);
  assert.throws(()=>percentChangeInEstimatedDps('100',0,'1',900));
});

test('Mirror World: reported best is within loaded sessions, not an all-time claim',()=>{
  const make=(id:string,date:string,total:string,duration:number):MirrorTrendSource=>({
    sessionId:id,startsAt:new Date(date),durationSeconds:duration,
    rank:null,damageRaw:'display',damageEstimate:total,
    approximate:true,sourceReference:'test.png'
  });
  const result=buildMirrorTrends([
    make('s1','2026-11-01T10:00:00Z','18800000000',900),
    make('s2','2026-11-04T10:00:00Z','20000000000',900),
    make('s3','2026-11-08T10:00:00Z','19000000000',900)
  ]);
  assert.deepEqual(result.map(p=>p.bestAmongDisplayed),[false,true,false]);
  assert.deepEqual(result.map(p=>p.changeFromPreviousPercent),[null,'+6.38','-5.00']);
  assert.equal(result[0].averageDpsEstimate,'20888888.89');
});
