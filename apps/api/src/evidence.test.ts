import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readdir, rm, utimes, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './auth/password.js';
import { expireEvidence } from './cli/cleanup-evidence.js';
import { attendanceEvidence, attendanceCheckpoints, attendanceEvents,
  officerAccounts, officerSessions, officerAudit } from './db/schema.js';

const url=process.env.AUTH_TEST_DATABASE_URL;
const png=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9P7aAAAAAASUVORK5CYII=','base64');

test('7-day private screenshot upload, signature rejection, expiry metadata, secure cleanup',
  {skip:!url}, async()=>{
    const dir=await mkdtemp(join(tmpdir(),'aeter-evidence-test-'));
    const pool=new pg.Pool({connectionString:url!,max:2});
    const db=drizzle(pool);
    const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173',UPLOAD_DIR:dir});
    const app=createApp(pool,config);
    const origin=config.APP_ORIGIN;
    const root='/api/management/attendance/evidence';
    const checkpointBase='/api/management/attendance/events';
    const leader=request.agent(app);
    async function cleanDb(){
      await db.delete(attendanceCheckpoints);
      await db.delete(attendanceEvents);
      await db.delete(attendanceEvidence);
      await db.delete(officerSessions);
      await db.delete(officerAudit);
      await db.delete(officerAccounts);
    }
    try{
      await cleanDb();
      await request(app).post(root).attach('image',png,'roster.png').expect(401);
      await db.insert(officerAccounts).values({username:'leader',displayName:'Leader',
        role:'GUILD_LEADER',passwordHash:await hashPassword('test-evidence-only-strong-passphrase'),
        mustChangePassword:false});
      await leader.post('/api/auth/login').set('Origin',origin).send({
        username:'leader',password:'test-evidence-only-strong-passphrase'
      }).expect(200);
      await leader.post(root).attach('image',png,{filename:'roster.png',contentType:'image/png'}).expect(403);
      await leader.post(root).set('Origin',origin)
        .attach('image',Buffer.from('not an actual image'),{filename:'fake.png',contentType:'image/png'})
        .expect(415);
      await leader.post(root).set('Origin',origin)
        .attach('image',Buffer.alloc(5*1024*1024+1),{filename:'oversized.png',contentType:'image/png'})
        .expect(413);
      assert.equal((await readdir(dir)).length,0,'Oversized upload must not retain a partial file');
      const upload=await leader.post(root).set('Origin',origin)
        .attach('image',png,{filename:'roster.png',contentType:'image/png'}).expect(201);
      const id=upload.body.evidence.id as string;
      assert.ok(id);
      assert.equal(upload.body.evidence.status,'AVAILABLE');
      assert.equal(upload.body.evidence.mimeType,'image/png');
      assert.equal(upload.body.evidence.bytes,png.length);
      assert.equal((await readdir(dir)).length,1);
      await request(app).get(root+'/'+id+'/file').expect(401);
      const served=await leader.get(root+'/'+id+'/file').expect(200);
      assert.equal(served.headers['content-type'],'image/png');
      assert.equal(served.headers['cache-control'],'no-store, private');
      const metadata=await leader.get(root+'/'+id+'/meta').expect(200);
      assert.equal(metadata.body.evidence.status,'AVAILABLE');
      assert.equal(metadata.body.evidence.originalName,'roster.png');

      const event=await leader.post(checkpointBase).set('Origin',origin).send({
        title:'Screenshot Test Event',eventType:'GUILD_LEAGUE',startsAt:'2026-11-11T10:00:00+08:00'
      }).expect(201);
      const eventId=event.body.event.id as string;
      await leader.post(`${checkpointBase}/${eventId}/checkpoints`).set('Origin',origin).send({
        phase:'BEFORE',coverage:'PARTIAL',capturedAt:'2026-11-11T09:55:00+08:00',
        evidenceRef:'roster.png',evidenceUploadId:id
      }).expect(201);
      const eventData=await leader.get(checkpointBase+'/'+eventId).expect(200);
      assert.equal(eventData.body.evidence[0].status,'AVAILABLE');
      assert.equal(eventData.body.checkpoints[0].evidenceUploadId,id);
      await leader.post(`${checkpointBase}/${eventId}/checkpoints`).set('Origin',origin).send({
        phase:'DURING',coverage:'PARTIAL',capturedAt:'2026-11-11T10:10:00+08:00',
        evidenceRef:'roster.png',evidenceUploadId:id
      }).expect(409);

      await db.update(attendanceEvidence).set({expiresAt:new Date(Date.now()-1000)})
        .where(eq(attendanceEvidence.id,id));
      await leader.get(root+'/'+id+'/file').expect(410);
      const expiredMeta=await leader.get(root+'/'+id+'/meta').expect(200);
      assert.equal(expiredMeta.body.evidence.status,'EXPIRED');
      const outcome=await expireEvidence(pool,dir,new Date());
      assert.equal(outcome.expired,1);
      const remaining=await readdir(dir);
      assert.equal(remaining.length,0);
      const orphan=randomUUID();
      const orphanPath=join(dir,orphan);
      await writeFile(orphanPath,png);
      const twoHoursAgo=new Date(Date.now()-2*60*60*1000);
      await utimes(orphanPath,twoHoursAgo,twoHoursAgo);
      const orphanSweep=await expireEvidence(pool,dir,new Date());
      assert.equal(orphanSweep.orphans,1,'Old aborted uploads must be removed');

      const [row]=await db.select().from(attendanceEvidence).where(eq(attendanceEvidence.id,id));
      assert.ok(row.deletedAt);
      assert.equal((await leader.get(checkpointBase+'/'+eventId).expect(200)).body.evidence[0].status,'EXPIRED');
    }finally{
      await cleanDb();await pool.end();await rm(dir,{recursive:true,force:true});
    }
  });
