import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { officerAccounts, officerSessions, officerAudit,
  memberAliases, memberChanges, weeklyGrCorrections, weeklyGearRatings, members } from './db/schema.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './auth/password.js';

const url=process.env.AUTH_TEST_DATABASE_URL;
test('server roster requires officer login, preserves aliases and audits weekly GR corrections',
  {skip:!url}, async()=>{
    const pool=new pg.Pool({connectionString:url,max:3});
    const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173'});
    const app=createApp(pool,config),db=drizzle(pool);
    const origin=config.APP_ORIGIN;
    async function cleanup(){
      await db.delete(weeklyGrCorrections);await db.delete(weeklyGearRatings);
      await db.delete(memberAliases);await db.delete(memberChanges);await db.delete(members);
      await db.delete(officerSessions);await db.delete(officerAudit);await db.delete(officerAccounts);
    }
    const fixture={
      characterName:'Aeternum-Test-α',jobClass:'Alchemist',guildRole:'Elite',
      combatRole:'DPS',memberStatus:'ACTIVE',joinedOn:'2026-11-10'
    };
    const password='test-only-leader-roster-password-2026';
    const agent=request.agent(app);
    try{
      await cleanup();
      await request(app).get('/api/management/members').expect(401);
      await request(app).post('/api/management/members').send(fixture).expect(401);
      await db.insert(officerAccounts).values({username:'leader',displayName:'Leader',
        role:'GUILD_LEADER',passwordHash:await hashPassword(password),mustChangePassword:false});
      await agent.post('/api/auth/login').set('Origin',origin).send({username:'leader',password}).expect(200);
      await agent.post('/api/management/members').send(fixture).expect(403);
      const created=await agent.post('/api/management/members').set('Origin',origin).send(fixture).expect(201);
      const id=created.body.member.id as string;
      assert.ok(id);
      assert.equal(created.body.member.version,1);
      await agent.post('/api/management/members').set('Origin',origin).send(fixture).expect(409);
      const roster=await agent.get('/api/management/members?limit=250').expect(200);
      assert.equal(roster.body.total,1);
      await agent.patch(`/api/management/members/${id}`).set('Origin',origin)
        .send({characterName:'Aeternum-Test-Renamed',version:99}).expect(409);
      const renamed=await agent.patch(`/api/management/members/${id}`).set('Origin',origin)
        .send({characterName:'Aeternum-Test-Renamed',version:1}).expect(200);
      assert.equal(renamed.body.member.version,2);
      const aliases=await db.select().from(memberAliases);
      assert.equal(aliases[0].alias,'Aeternum-Test-α');

      const week='2026-11-09';
      const root=`/api/management/members/${id}/weekly-gr`;
      await agent.post(root).set('Origin',origin)
        .send({weekStart:week,gearRating:65000,sourceReference:null,verified:true,capturedAt:null}).expect(400);
      await agent.post(root).set('Origin',origin)
        .send({weekStart:week,gearRating:65000,sourceReference:'verified-roster-1.png',verified:true,capturedAt:null}).expect(201);
      await agent.post(root).set('Origin',origin)
        .send({weekStart:week,gearRating:65000,sourceReference:'verified-roster-1.png',verified:true,capturedAt:null}).expect(409);
      const list=await agent.get(root).expect(200);
      assert.equal(list.body.snapshots[0].gearRating,65000);
      assert.ok(list.body.snapshots[0].reviewedAt);
      const snap=list.body.snapshots[0].id as string;
      await agent.post(`${root}/${snap}/correct`).set('Origin',origin).send({
        version:99,gearRating:66100,sourceReference:'corrected-roster.png',
        verified:true,capturedAt:null,reason:'Rechecked original screenshot'
      }).expect(409);
      await agent.post(`${root}/${snap}/correct`).set('Origin',origin).send({
        version:1,gearRating:66100,sourceReference:'corrected-roster.png',
        verified:true,capturedAt:null,reason:'Rechecked original screenshot'
      }).expect(200);
      const history=await agent.get(`${root}/${snap}/corrections`).expect(200);
      assert.equal(history.body.corrections.length,1);
      assert.equal(history.body.corrections[0].previousValue,65000);
      assert.equal(history.body.corrections[0].updatedValue,66100);
      await agent.post('/api/management/roster-import').set('Origin',origin).send({members:[
        {...fixture,legacyId:'MBR-1'}
      ]}).expect(409);
      await db.insert(officerAccounts).values({username:'clerk',displayName:'Clerk',role:'CLERK',
        passwordHash:await hashPassword('temporary-test-clerk-password'),mustChangePassword:true});
      const clerk=request.agent(app);
      await clerk.post('/api/auth/login').set('Origin',origin).send({username:'clerk',
        password:'temporary-test-clerk-password'}).expect(200);
      await clerk.get('/api/management/members').expect(403);
    }finally{await cleanup();await pool.end();}
  });

test('reviewed one-time browser import maps legacy IDs without importing gear', {skip:!url}, async()=>{
  const pool=new pg.Pool({connectionString:url!,max:3});
  const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173'});
  const db=drizzle(pool),agent=request.agent(createApp(pool,config));
  try{
    await db.delete(weeklyGrCorrections);await db.delete(weeklyGearRatings);
    await db.delete(memberAliases);await db.delete(memberChanges);await db.delete(members);
    await db.delete(officerSessions);await db.delete(officerAudit);await db.delete(officerAccounts);
    await db.insert(officerAccounts).values({username:'leader',displayName:'Leader',role:'GUILD_LEADER',
      passwordHash:await hashPassword('test-import-password-long'),mustChangePassword:false});
    await agent.post('/api/auth/login').set('Origin',config.APP_ORIGIN).send({
      username:'leader',password:'test-import-password-long'
    }).expect(200);
    const rows=[{legacyId:'MBR-ALPHA',characterName:'Guild-Alpha',jobClass:'Knight',
      guildRole:null,combatRole:'Tank',memberStatus:'ACTIVE',joinedOn:null}];
    const result=await agent.post('/api/management/roster-import')
      .set('Origin',config.APP_ORIGIN).send({members:rows}).expect(201);
    assert.equal(result.body.imported,1);
    assert.equal(result.body.mapping[0].legacyId,'MBR-ALPHA');
    await agent.post('/api/management/roster-import')
      .set('Origin',config.APP_ORIGIN).send({members:rows}).expect(409);
    assert.equal((await db.select().from(members)).length,1);
  }finally{
    await db.delete(weeklyGrCorrections);await db.delete(weeklyGearRatings);
    await db.delete(memberAliases);await db.delete(memberChanges);await db.delete(members);
    await db.delete(officerSessions);await db.delete(officerAudit);await db.delete(officerAccounts);
    await pool.end();
  }
});
