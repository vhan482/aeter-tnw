import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createApp } from '../app.js';
import { loadConfig } from '../config.js';
import { hashPassword } from '../auth/password.js';
import { members, memberAliases, officerAccounts, officerSessions, officerAudit,
  mirrorWorldBosses, mirrorWorldSessions, mirrorWorldResults, mirrorWorldResultHistory,
  mirrorWorldBossHistory } from '../db/schema.js';

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
      await db.delete(mirrorWorldSessions);await db.delete(mirrorWorldBossHistory);
      await db.delete(mirrorWorldBosses);
      await db.delete(memberAliases);await db.delete(members);
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
      const bossUpdate=root+'/bosses/'+bossId;
      const bossFields={
        name:'Boss Test Updated',race:'Demon',size:'Large',element:'Fire',
        elementLevel:2,reason:'Verified from in-game boss panel'
      };
      await clerk.patch(bossUpdate).set('Origin',origin)
        .send({...bossFields,version:1}).expect(403);
      await leader.patch(bossUpdate).send({...bossFields,version:1}).expect(403);
      await leader.patch(bossUpdate).set('Origin',origin)
        .send({...bossFields,version:999}).expect(409);
      await leader.patch(bossUpdate).set('Origin',origin)
        .send({...bossFields,version:1,reason:'no'}).expect(400);
      const bossChange=await leader.patch(bossUpdate).set('Origin',origin)
        .send({...bossFields,version:1}).expect(200);
      assert.equal(bossChange.body.boss.version,2);
      assert.equal(bossChange.body.boss.elementLevel,2);
      const bossHistory=await clerk.get(bossUpdate+'/history').expect(200);
      assert.equal(bossHistory.body.changes.length,1);
      assert.equal(bossHistory.body.changes[0].before.name,'Boss Test');
      assert.equal(bossHistory.body.changes[0].after.element,'Fire');

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

      const [second,third]=await db.insert(members).values([
        {characterName:'Second Fixture',jobClass:'Mage'},
        {characterName:'Third Fixture',jobClass:'Knight'}
      ]).returning();
      await db.insert(memberAliases).values({memberId:second.id,alias:'Renamed Mage'});
      const rosterIndex=await clerk.get(root+'/roster-index').expect(200);
      assert.ok(rosterIndex.body.members.some((p:{id:string;aliases:string[]})=>
        p.id===second.id&&p.aliases.includes('Renamed Mage')));
      await request(app).get(root+'/roster-index').expect(401);

      const batch=root+'/sessions/'+sid+'/results/batch';
      const secondRow={...row,memberId:second.id,rank:2,damageRaw:'14.3B'};
      const thirdRow={...row,memberId:third.id,rank:4,damageRaw:'9.8B'};
      await clerk.post(batch).send({reviewed:true,rows:[secondRow]}).expect(403);
      await clerk.post(batch).set('Origin',origin)
        .send({reviewed:false,rows:[secondRow]}).expect(400);
      await clerk.post(batch).set('Origin',origin)
        .send({reviewed:true,rows:[secondRow,secondRow]}).expect(409);
      await clerk.post(batch).set('Origin',origin)
        .send({reviewed:true,rows:[secondRow,{...thirdRow,rank:2}]}).expect(409);
      await clerk.post(batch).set('Origin',origin)
        .send({reviewed:true,rows:[secondRow,{...thirdRow,damageRaw:'unreadable'}]}).expect(422);
      const inserted=await clerk.post(batch).set('Origin',origin)
        .send({reviewed:true,rows:[secondRow,thirdRow]}).expect(201);
      assert.equal(inserted.body.created,2);
      await clerk.post(batch).set('Origin',origin)
        .send({reviewed:true,rows:[secondRow]}).expect(409);

      const detail=await leader.get(root+'/sessions/'+sid).expect(200);
      assert.equal(detail.body.results.length,3);
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
      assert.equal((await clerk.get(root+'/sessions/'+sid).expect(200)).body.results.length,3);

      const secondSession=await clerk.post(root+'/sessions').set('Origin',origin)
        .send({bossId,startsAt:'2026-11-18T20:00:00+08:00',
          durationSeconds:600,rotation:null}).expect(201);
      await clerk.post(root+'/sessions/'+secondSession.body.session.id+'/results')
        .set('Origin',origin).send({...row,damageRaw:'18.9B',rank:1}).expect(201);
      const insightsUrl=root+'/insights?bossId='+bossId+'&memberId='+member.id;
      await request(app).get(insightsUrl).expect(401);
      await clerk.get(root+'/insights?bossId=bad&memberId='+member.id).expect(400);
      const insights=await clerk.get(insightsUrl).expect(200);
      assert.equal(insights.body.member.id,member.id);
      assert.equal(insights.body.rows.length,2);
      assert.equal(insights.body.rows[0].changeFromPreviousPercent,'+50.00');
      assert.equal(insights.body.rows[0].bestAmongDisplayed,true);
      assert.equal(insights.body.rows[1].bestAmongDisplayed,false);
      assert.equal(insights.body.rows[1].changeFromPreviousPercent,null);
      assert.equal(insights.body.hasMore,false);

      // A session where this member is not visible must not become a fake zero.
      await clerk.post(root+'/sessions').set('Origin',origin)
        .send({bossId,startsAt:'2026-11-19T20:00:00+08:00',
          durationSeconds:900,rotation:null}).expect(201);
      assert.equal((await clerk.get(insightsUrl).expect(200)).body.rows.length,2);

    }finally{await clear();await pool.end();}
  });
