import assert from 'node:assert/strict';
import test from 'node:test';
import {parseLeagueTabText,validLeagueField,leagueFieldSets} from '../../../src/lib/league-ocr.ts';
import {matchRosterIdentity} from '../../../src/lib/mirror-ocr.ts';

test('League OCR: Main/Sub DPS values remain total damage, no assumed rank or absent player',()=>{
  const sample='Main DPS Ranking\n1 Alpha 8 12 18.8B 1.2M\n3 Bravo 0 2 5B -';
  const rows=parseLeagueTabText(sample,'DPS');
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.detectedName),['Alpha','Bravo']);
  assert.deepEqual(rows.map(r=>r.visibleRank),[1,3]);
  assert.deepEqual(rows[0].values,{kills:'8',assists:'12',
    playerDamageRaw:'18.8B',buildingDamageRaw:'1.2M'});
  assert.equal(rows[1].values.kills,'0');
  assert.equal(rows[1].values.buildingDamageRaw,'');
  assert.equal(rows[1].warnings.some(w=>w.includes('Missing')),true);
  assert.equal(rows.some(r=>r.visibleRank===2),false);
});

test('League OCR: Support sorted differently, unknowns preserved rather than fabricated',()=>{
  const data='2 Bravo 0 2 8.4M 3M\n1 Alpha 3 0 - 1.2M';
  const rows=parseLeagueTabText(data,'SUPPORT');
  assert.deepEqual(rows.map(r=>r.detectedName),['Bravo','Alpha']);
  assert.equal(rows[0].values.deaths,'0');
  assert.equal(rows[0].values.revives,'2');
  assert.equal(rows[1].values.healingRaw,'');
  assert.equal(rows[1].values.damageTakenRaw,'1.2M');
});

test('League OCR: Sub Strategy labels stay neutral and wrapped lines do not invent full rows',()=>{
  const rows=parseLeagueTabText('1 Alpha 1M 2 0 3.4B\n2 Wrapped\n3 Another 1 2','STRATEGY');
  assert.equal(rows.length,1);
  assert.equal(rows[0].values.minionMetricRaw,'1M');
  assert.equal(rows[0].values.flagRepairs,'2');
  assert.equal(rows[0].values.bossFinishers,'0');
  assert.equal(rows[0].values.bossDamageRaw,'3.4B');
  assert.equal(leagueFieldSets.STRATEGY[0].label.includes('unverified'),true);
});

test('League OCR: incorrect glyphs are candidates for correction, not accepted fields',()=>{
  const rows=parseLeagueTabText('1 PlayerA O 2 18.8B 3M\n1 PlayerA 0 2 18.8B 3M','DPS');
  assert.equal(rows.length,2);
  assert.equal(validLeagueField(rows[0].values.kills,'count'),false);
  assert.equal(rows[0].warnings.some(w=>w.includes('Kills')),true);
  assert.equal(rows[0].warnings.some(w=>w.includes('Repeated')),true);
  assert.equal(validLeagueField('0','count'),true);
  assert.equal(validLeagueField('2.2','count'),false);
  assert.equal(validLeagueField('2,000','count'),false);
  assert.equal(validLeagueField('18.8B','amount'),true);
  assert.equal(validLeagueField('18.8','amount'),false);
  assert.equal(validLeagueField('-','amount'),false);
});

test('League OCR: ambiguous alias never resolves to a guessed member ID',()=>{
  const roster=[
    {id:'one',characterName:'Player A',aliases:['Alpha']},
    {id:'two',characterName:'Player B',aliases:['Shadow']},
    {id:'three',characterName:'Player C',aliases:['Shadow']}
  ];
  assert.deepEqual(matchRosterIdentity('Shadow',roster),{memberId:null,status:'AMBIGUOUS'});
  assert.deepEqual(matchRosterIdentity('ALPHA',roster),{memberId:'one',status:'EXACT'});
  assert.deepEqual(matchRosterIdentity('A1pha',roster),{memberId:null,status:'UNMATCHED'});
});


import { parseLeagueVerifiedRows, benchmarkLeagueOcr } from '../../../src/lib/league-ocr-benchmark.ts';

test('League OCR calibration: independently labeled rows measure recognition coverage',()=>{
  const labeled=parseLeagueVerifiedRows([
    'Alpha | 8 | 12 | 18.8B | 1.2M',
    'Bravo | 0 | 2 | 5B | ?',
    'Charlie | 3 | 4 | 1M | 2M'
  ].join('\n'),'DPS');
  assert.deepEqual(labeled.errors,[]);
  const report=benchmarkLeagueOcr('DPS',
    '1 Alpha 8 12 18.8B 1.2M\n3 Bravo 0 2 5B -\n4 Gambled 3 4 1M 2M',
    labeled.rows,{at:'2026-11-12T00:00:00.000Z',sourceName:'synthetic-test.png'});
  assert.equal(report.labeledRows,3);
  assert.equal(report.ocrCandidates,3);
  assert.equal(report.matchedRows,2);
  assert.equal(report.rowRecallPercent,66.67);
  assert.equal(report.candidatePrecisionPercent,66.67);
  assert.equal(report.totalLabeledCells,11);
  assert.equal(report.totalComparedCells,7);
  assert.equal(report.totalCorrectCells,7);
  assert.equal(report.comparedFieldAccuracyPercent,100);
  assert.equal(report.endToEndFieldCoveragePercent,63.64);
  assert.equal(report.fields.find(f=>f.key==='kills')?.coveragePercent,66.67);
  assert.ok(report.issues.some(x=>x.kind==='MISSING_ROW'&&x.name==='Charlie'));
  assert.ok(report.issues.some(x=>x.kind==='EXTRA_OCR_ROW'&&x.name==='Gambled'));
  assert.equal(report.sourceName,'synthetic-test.png');
});

test('League OCR calibration: wrong cell, duplicate OCR name and unverified cells',()=>{
  const labeled=parseLeagueVerifiedRows('Alpha | 8 | 12 | ? | 1.2M','DPS');
  const wrong=benchmarkLeagueOcr('DPS','1 Alpha 9 12 1M 1.2M',labeled.rows);
  assert.equal(wrong.totalLabeledCells,3);
  assert.equal(wrong.totalCorrectCells,2);
  assert.equal(wrong.comparedFieldAccuracyPercent,66.67);
  assert.equal(wrong.issues.find(x=>x.kind==='FIELD_MISMATCH')?.field,'kills');
  const duplicate=benchmarkLeagueOcr('DPS',
    '1 Alpha 8 12 1M 1M\n3 Alpha 8 12 1M 1M',labeled.rows);
  assert.equal(duplicate.matchedRows,0);
  assert.equal(duplicate.rowRecallPercent,0);
  assert.equal(duplicate.comparedFieldAccuracyPercent,null);
  assert.ok(duplicate.issues.some(x=>x.kind==='DUPLICATE_OCR_NAME'));
});

test('League OCR calibration: ground truth requires explicit unique player names and 4 cells',()=>{
  const bad=parseLeagueVerifiedRows(
    'Alpha | 8 | 12 | 1M\nAlpha | 8 | 12 | 1M | 1M\nALPHA | 8 | 12 | 1M | 1M',
    'DPS');
  assert.equal(bad.rows.length,1);
  assert.equal(bad.errors.length,2);
  assert.throws(()=>benchmarkLeagueOcr('DPS','1 Alpha 8 12 1M 1M',[
    {name:'Alpha',values:{}},{name:'ALPHA',values:{}}
  ]));
});
