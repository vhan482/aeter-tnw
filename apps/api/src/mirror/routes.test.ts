import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { hashPassword } from '../auth/password.js';
import { members, officerAccounts, officerSessions, officerAudit,
  mirrorWorldBosses, mirrorWorldSessions, mirrorWorldResults, mirrorWorldResultHistory } from '../db/schema.js';

const url=process.env.AUTH_TEST_DATABASE_URL;

test('Mirror World: boss/session, human-reviewed leaderboard, privacy and audited correction',
  {skip:!url},async()=>{
    const pool=new pg.Pool({connectionString:url!,max:3});
    const db=drizzle(pool);
    const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173'});
    const app=createApp(pool,config);
    const origin=config.APP_ORIGIN;
    const root='/api/management/mirror-world';
    const leader=request.agent(app),clerk=request.agent(app);
    async function clear(){
      await db.delete(mirrorWorldResultHistory);await db.delete(mirrorWorldResults);
      await db.delete(mirrorWorldSessions);await db.delete(mirrorWorldBosses);
      await db.delete(members);
      await db.delete(officerSessions);await db.delete(officerAudit);
      await db.delete(officerAccounts);
    }
    try{
      await clear();
      await request(app).get(root+'/bosses').expect(401);
      const pw='test-only-mirror-passphrase-2026';
      await db.insert(officerAccounts).values([
        {username:'leader',displayName:'Leader',role:'GUILD_LEADER',passwordHash:await hashPassword(pw),mustChangePassword:false},
        {username:'clerk',displayName:'Clerk',role:'CLERK',passwordHash:await hashPassword(pw),mustChangePassword:false}
      ]);
      const [member]=await db.insert(members).values({characterName:'Mirror Fixture',jobClass:'Alchemist'}).returning();
      await leader.post('/api/auth/login').set('Origin',origin).send({username:'leader',password:pw}).expect(200);
      await clerk.post('/api/auth/login').set('Origin',origin).send({username:'clerk',password:pw}).expect(200);
      await clerk.post(root+'/bosses').set('Origin',origin).send({name:'Boss Test'}).expect(403);
      await leader.post(root+'/bosses').send({name:'Boss Test'}).expect(403);
      const b=await leader.post(root+'/bosses').set('Origin',origin)
        .send({name:'Boss Test',race:null,size:null,element:null,elementLevel:null}).expect(201);
      const bossId=b.body.boss.id as string;
      await leader.post(root+'/bosses').set('Origin',origin)
        .send({name:'boss test'}).expect(409);
      const session=await clerk.post(root+'/sessions').set('Origin',origin)
        .send({bossId,startsAt:'2026-11-11T20:00:00+08:00',
          durationSeconds:900,rotation:null}).expect(201);
      const sid=session.body.session.id as string;
      const path=root+'/sessions/'+sid+'/results';
      const row={memberId:member.id,rank:1,damageRaw:'18.8B',
        sourceReference:'mirror-ranking-p1.png',evidenceUploadId:null,reviewed:true};
      await clerk.post(path).send(row).expect(403);
      await clerk.post(path).set('Origin',origin)
        .send({...row,reviewed:false}).expect(400);
      await clerk.post(path).set('Origin',origin)
        .send({...row,damageRaw:'garbled'}).expect(422);
      await clerk.post(path).set('Origin',origin).send(row).expect(201);
      await clerk.post(path).set('Origin',origin).send(row).expect(409);
      const detail=await leader.get(root+'/sessions/'+sid).expect(200);
      assert.equal(detail.body.results.length,1);
      assert.equal(detail.body.results[0].damageRaw,'18.8B');
      assert.equal(detail.body.results[0].damageEstimate,'18800000000');
      assert.equal(detail.body.results[0].averageDpsEstimate,'20888888.89');
      assert.equal(detail.body.results[0].approximate,true);
      const rid=detail.body.results[0].id as string;
      const edit=root+'/sessions/'+sid+'/results/'+rid;
      await leader.patch(edit).set('Origin',origin).send({
        ...row,damageRaw:'18.9B',version:42,reason:'Re-read source'
      }).expect(409);
      await leader.patch(edit).set('Origin',origin).send({
        ...row,damageRaw:'18.9B',version:1,reason:'Re-read source'
      }).expect(200);
      const history=await leader.get(edit+'/history').expect(200);
      assert.equal(history.body.changes.length,1);
      assert.equal(history.body.changes[0].before.damageRaw,'18.8B');
      assert.equal(history.body.changes[0].after.damageRaw,'18.9B');
      assert.equal((await clerk.get(root+'/sessions/'+sid).expect(200)).body.results.length,1);
    }finally{await clear();await pool.end();}
  });
