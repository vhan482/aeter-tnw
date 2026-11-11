import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './auth/password.js';
import { members,memberAliases,officerAccounts,officerSessions,officerAudit,
  leagueMatches,leaguePlayerTabResults,leaguePlayerTabHistory } from './db/schema.js';
import { mergeLeagueRows, type LeagueTabRow } from './league/metrics.js';

const url=process.env.AUTH_TEST_DATABASE_URL;

test('League: authenticated Main/Sub capture, identity merge, audited corrections',
  {skip:!url},async()=>{
  const pool=new pg.Pool({connectionString:url!,max:3});
  const db=drizzle(pool);
  const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173'});
  const app=createApp(pool,config),origin=config.APP_ORIGIN;
  const leader=request.agent(app),clerk=request.agent(app);
  const root='/api/management/league';
  async function cleanup(){
    await db.delete(leaguePlayerTabHistory);
    await db.delete(leaguePlayerTabResults);
    await db.delete(leagueMatches);
    await db.delete(memberAliases);
    await db.delete(members);
    await db.delete(officerSessions);
    await db.delete(officerAudit);
    await db.delete(officerAccounts);
  }
  try{
    await cleanup();
    await request(app).get(root+'/matches').expect(401);
    const password='synthetic-league-testing-password-2026';
    await db.insert(officerAccounts).values([
      {username:'leader',displayName:'Leader',role:'GUILD_LEADER',
        passwordHash:await hashPassword(password),mustChangePassword:false},
      {username:'clerk',displayName:'Clerk',role:'CLERK',
        passwordHash:await hashPassword(password),mustChangePassword:false}
    ]);
    const [memberA,memberB]=await db.insert(members).values([
      {characterName:'Member Alpha',jobClass:'Assassin'},
      {characterName:'Member Beta',jobClass:'Priest'}
    ]).returning();
    await leader.post('/api/auth/login').set('Origin',origin)
      .send({username:'leader',password}).expect(200);
    await clerk.post('/api/auth/login').set('Origin',origin)
      .send({username:'clerk',password}).expect(200);
    const metadata={opponentGuild:'Synthetic Opponent',
      occurredAt:'2026-11-11T21:00:00+08:00',stage:'FINAL',result:'WIN'};
    await clerk.post(root+'/matches').send(metadata).expect(403);
    const created=await clerk.post(root+'/matches').set('Origin',origin)
      .send(metadata).expect(201);
    const matchId=created.body.match.id as string;
    const endpoint=root+'/matches/'+matchId+'/tab-results';
    const dps=(memberId:string,rank:number)=>({
      memberId,battlefield:'MAIN',tab:'DPS',
      metrics:{kills:rank,assists:0,playerDamageRaw:'18.8B',buildingDamageRaw:null},
      sourceReference:'test-main-dps.png',evidenceUploadId:null,reviewed:true
    });
    const support=(memberId:string,deaths:number)=>({
      memberId,battlefield:'MAIN',tab:'SUPPORT',
      metrics:{deaths,revives:0,healingRaw:null,damageTakenRaw:'2M'},
      sourceReference:'test-main-support.png',evidenceUploadId:null,reviewed:true
    });
    await clerk.post(endpoint).set('Origin',origin)
      .send({...dps(memberA.id,2),reviewed:false}).expect(400);
    await clerk.post(endpoint).set('Origin',origin)
      .send({...dps(memberA.id,2),metrics:{...dps(memberA.id,2).metrics,
        arbitraryField:999}}).expect(400);
    await clerk.post(endpoint).set('Origin',origin)
      .send({...dps(memberA.id,2),metrics:{kills:null,assists:null,
        playerDamageRaw:null,buildingDamageRaw:null}}).expect(400);
    await clerk.post(endpoint).set('Origin',origin)
      .send({...dps(memberA.id,2),metrics:{...dps(memberA.id,2).metrics,
        playerDamageRaw:'bad value'}}).expect(400);
    await clerk.post(endpoint).send(dps(memberA.id,2)).expect(403);

    const first=await clerk.post(endpoint).set('Origin',origin)
      .send(dps(memberA.id,2)).expect(201);
    await clerk.post(endpoint).set('Origin',origin)
      .send(dps(memberA.id,2)).expect(409);
    await clerk.post(endpoint).set('Origin',origin)
      .send(dps(memberB.id,1)).expect(201);
    await clerk.post(endpoint).set('Origin',origin)
      .send(support(memberB.id,0)).expect(201);
    await clerk.post(endpoint).set('Origin',origin)
      .send(support(memberA.id,3)).expect(201);
    const subDps={...dps(memberA.id,5),battlefield:'SUB',
      sourceReference:'test-sub-dps.png'};
    await clerk.post(endpoint).set('Origin',origin).send(subDps).expect(201);
    const strategy={
      memberId:memberA.id,battlefield:'SUB',tab:'STRATEGY',
      metrics:{minionMetricRaw:null,flagRepairs:2,bossFinishers:0,bossDamageRaw:'1.2B'},
      sourceReference:'test-sub-strategy.png',evidenceUploadId:null,reviewed:true
    };
    await clerk.post(endpoint).set('Origin',origin)
      .send({...strategy,battlefield:'MAIN'}).expect(400);
    await clerk.post(endpoint).set('Origin',origin).send(strategy).expect(201);

    const detail=await leader.get(root+'/matches/'+matchId).expect(200);
    assert.equal(detail.body.observations.length,6);
    assert.equal(detail.body.players.length,3);
    const mainA=detail.body.players.find((row:{battlefield:string;memberId:string})=>
      row.battlefield==='MAIN'&&row.memberId===memberA.id);
    const mainB=detail.body.players.find((row:{battlefield:string;memberId:string})=>
      row.battlefield==='MAIN'&&row.memberId===memberB.id);
    const subA=detail.body.players.find((row:{battlefield:string;memberId:string})=>
      row.battlefield==='SUB'&&row.memberId===memberA.id);
    assert.equal(mainA.kills,2);assert.equal(mainA.deaths,3);
    assert.equal(mainB.deaths,0);
    assert.equal(mainA.totalPlayerDamageEstimate,'18800000000');
    assert.equal(mainA.totalBuildingDamageEstimate,null);
    assert.equal(subA.strategy.metrics.flagRepairs,2);
    assert.equal(subA.support,null);

    const correction=root+'/matches/'+matchId+'/tab-results/'+first.body.observation.id;
    await clerk.patch(correction).set('Origin',origin)
      .send({value:{...dps(memberA.id,4)},version:2,reason:'Verified screenshot'}).expect(409);
    await clerk.patch(correction).set('Origin',origin)
      .send({value:{...dps(memberB.id,4)},version:1,reason:'Verified screenshot'}).expect(409);
    await clerk.patch(correction).set('Origin',origin)
      .send({value:{...dps(memberA.id,4)},version:1,reason:'no'}).expect(400);
    await clerk.patch(correction).set('Origin',origin)
      .send({value:{...dps(memberA.id,4)},version:1,
        reason:'Corrected kill count from a clearer source'}).expect(200);
    const history=await clerk.get(correction+'/history').expect(200);
    assert.equal(history.body.changes.length,1);
    assert.equal(history.body.changes[0].before.metrics.kills,2);
    assert.equal(history.body.changes[0].after.metrics.kills,4);
    assert.equal((await clerk.get(root+'/matches/'+matchId).expect(200))
      .body.players.find((r:{memberId:string;battlefield:string})=>
        r.memberId===memberA.id&&r.battlefield==='MAIN').kills,4);
    await request(app).get(correction+'/history').expect(401);

    // A new match proves atomic reviewed imports without changing the
    // original single-row fixture or mixing differently sorted screenshot tabs.
    const batchMatch=await clerk.post(root+'/matches').set('Origin',origin)
      .send({...metadata,opponentGuild:'Other Synthetic Opponent'}).expect(201);
    const batchMatchId=batchMatch.body.match.id as string;
    const batch=root+'/matches/'+batchMatchId+'/tab-results/batch';
    const batchRow=(id:string,kills:number)=>({
      memberId:id,reviewed:true,
      metrics:{kills,assists:0,playerDamageRaw:'18.8B',buildingDamageRaw:null}
    });
    const batchBody={battlefield:'MAIN',tab:'DPS',
      sourceReference:'test-reviewed-main-dps.png',
      evidenceUploadId:null,reviewed:true,
      rows:[batchRow(memberA.id,8),batchRow(memberB.id,3)]};
    await request(app).post(batch).send(batchBody).expect(401);
    await clerk.post(batch).send(batchBody).expect(403);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,reviewed:false}).expect(400);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,rows:[{...batchBody.rows[0],reviewed:false}]}).expect(400);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,rows:[batchBody.rows[0],batchBody.rows[0]]}).expect(409);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,tab:'SUPPORT'}).expect(400);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,battlefield:'MAIN',tab:'STRATEGY'}).expect(400);
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,rows:[{...batchRow(memberA.id,8),
        metrics:{kills:8,assists:0,playerDamageRaw:'bad',buildingDamageRaw:null}}]}).expect(400);
    const unknownId='00000000-0000-4000-8000-000000000001';
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,rows:[batchRow(unknownId,7)]}).expect(422);
    const imported=await clerk.post(batch).set('Origin',origin)
      .send(batchBody).expect(201);
    assert.equal(imported.body.created,2);
    await clerk.post(batch).set('Origin',origin)
      .send(batchBody).expect(409);
    const [thirdMember]=await db.insert(members).values({
      characterName:'Third Synthetic Member',jobClass:'Archer'
    }).returning();
    await clerk.post(batch).set('Origin',origin)
      .send({...batchBody,rows:[batchRow(memberA.id,9),batchRow(thirdMember.id,1)]})
      .expect(409);
    let batchDetail=await clerk.get(root+'/matches/'+batchMatchId).expect(200);
    assert.equal(batchDetail.body.observations.length,2);
    assert.equal(batchDetail.body.observations.some(
      (r:{memberId:string})=>r.memberId===thirdMember.id),false);

    const supportBody={...batchBody,tab:'SUPPORT',sourceReference:'support-source.png',
      rows:[
        {memberId:memberB.id,reviewed:true,
          metrics:{deaths:0,revives:1,healingRaw:'3M',damageTakenRaw:null}},
        {memberId:memberA.id,reviewed:true,
          metrics:{deaths:2,revives:0,healingRaw:null,damageTakenRaw:'1M'}}
      ]};
    await clerk.post(batch).set('Origin',origin).send(supportBody).expect(201);
    batchDetail=await clerk.get(root+'/matches/'+batchMatchId).expect(200);
    assert.equal(batchDetail.body.observations.length,4);
    const batchA=batchDetail.body.players.find((r:{memberId:string})=>r.memberId===memberA.id);
    const batchB=batchDetail.body.players.find((r:{memberId:string})=>r.memberId===memberB.id);
    assert.equal(batchA.kills,8);assert.equal(batchA.deaths,2);
    assert.equal(batchB.kills,3);assert.equal(batchB.deaths,0);
    assert.equal(batchB.healingEstimate,'3000000');

  }finally{await cleanup();await pool.end();}
});

test('League: source-tab sorting never merges by row order, unknown is not zero',()=>{
  const row=(field:'MAIN'|'SUB',tab:'DPS'|'SUPPORT',id:string,
    metrics:LeagueTabRow['metrics']):LeagueTabRow=>({
      id:field+tab+id,memberId:id,characterName:id,battlefield:field,tab,metrics,
      sourceReference:'fixture.png',evidenceUploadId:null,version:1,reviewedAt:new Date()
    });
  const result=mergeLeagueRows([
    row('MAIN','DPS','a',{kills:2,assists:0,playerDamageRaw:'1.2B',buildingDamageRaw:null}),
    row('MAIN','DPS','b',{kills:1,assists:null,playerDamageRaw:'1B',buildingDamageRaw:null}),
    row('MAIN','SUPPORT','b',{deaths:0,revives:3,healingRaw:'2M',damageTakenRaw:null}),
    row('MAIN','SUPPORT','a',{deaths:4,revives:0,healingRaw:null,damageTakenRaw:null}),
    row('SUB','DPS','a',{kills:5})
  ]);
  assert.equal(result.length,3);
  assert.equal(result.find(r=>r.battlefield==='MAIN'&&r.memberId==='a')?.deaths,4);
  assert.equal(result.find(r=>r.battlefield==='MAIN'&&r.memberId==='b')?.deaths,0);
  assert.equal(result.find(r=>r.battlefield==='SUB')?.deaths,null);
  assert.equal(result.find(r=>r.battlefield==='MAIN'&&r.memberId==='a')?.totalPlayerDamageEstimate,'1200000000');
});
