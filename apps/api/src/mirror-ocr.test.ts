import assert from 'node:assert/strict';
import test from 'node:test';
import { groupTextBlocks, matchRosterIdentity, parseMirrorLeaderboardText } from '../../../src/lib/mirror-ocr.ts';

test('Mirror OCR recognizes only explicit leaderboard rows and keeps gaps unknown',()=>{
  const rows=parseMirrorLeaderboardText(
    'Mirror World Individual Guild Ranking\n1 Alpha 18.8B\n2 Bravo 14.3B\n14 Highlight 8.7B'
  );
  assert.equal(rows.length,3);
  assert.deepEqual(rows.map(row=>row.rank),[1,2,14]);
  assert.deepEqual(rows.map(row=>row.damageRaw),['18.8B','14.3B','8.7B']);
  assert.equal(rows[0].detectedName,'Alpha');
  assert.equal(rows[2].detectedName,'Highlight');
  assert.equal(rows.some(row=>row.rank===3),false);
});

test('Mirror OCR flags overlapping observations and unknown ranks',()=>{
  const rows=parseMirrorLeaderboardText(
    'MageGirl 4.2B\n1 Alpha 18.8B\n1 Alpha 18.8B'
  );
  assert.equal(rows.length,3);
  assert.equal(rows[0].rank,null);
  assert.match(rows[0].warnings.join(' '),/Rank not visible/);
  assert.match(rows[1].warnings.join(' '),/Repeated name/);
  assert.match(rows[2].warnings.join(' '),/Repeated rank/);
});

test('Mirror OCR does not fabricate member identity from approximate spellings',()=>{
  const roster=[
    {id:'uuid-1',characterName:'Kimutaku',aliases:['Kimu']},
    {id:'uuid-2',characterName:'Other',aliases:['Shadow']},
    {id:'uuid-3',characterName:'Third',aliases:['Shadow']}
  ];
  assert.deepEqual(matchRosterIdentity('KIMUTAKU',roster),{memberId:'uuid-1',status:'EXACT'});
  assert.deepEqual(matchRosterIdentity('Kimu',roster),{memberId:'uuid-1',status:'EXACT'});
  assert.deepEqual(matchRosterIdentity('Shadow',roster),{memberId:null,status:'AMBIGUOUS'});
  assert.deepEqual(matchRosterIdentity('Kimutakv',roster),{memberId:null,status:'UNMATCHED'});
});

test('Mirror OCR groups device text bounding boxes by row and horizontal order',()=>{
  const input=[
    {rawValue:'18.8B',boundingBox:{x:410,y:12,width:70,height:20}},
    {rawValue:'Alpha',boundingBox:{x:150,y:10,width:70,height:20}},
    {rawValue:'1',boundingBox:{x:20,y:11,width:12,height:20}},
    {rawValue:'2 Bravo 14.3B',boundingBox:{x:20,y:44,width:240,height:20}}
  ];
  assert.equal(groupTextBlocks(input),'1 Alpha 18.8B\n2 Bravo 14.3B');
});
