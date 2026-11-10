import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import request from 'supertest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { hashPassword } from './auth/password.js';
import { members, officerAccounts, officerSessions, officerAudit,
  memberChanges, memberAliases, weeklyGearRatings, weeklyGrCorrections,
  attendanceEvents, attendanceCheckpoints, attendanceObservations,
  attendanceObservationCorrections, attendanceAssessments, attendanceAssessmentHistory,
  memberActionCases, memberActionNotes, memberActionAudit } from './db/schema.js';

const url=process.env.AUTH_TEST_DATABASE_URL;

test('Phase 3: screenshot uncertainty, officer-only cases, audited decisions and correction history',
  {skip:!url},async()=>{
    const pool=new pg.Pool({connectionString:url!,max:4});
    const db=drizzle(pool);
    const config=loadConfig({DATABASE_URL:url!,NODE_ENV:'test',APP_ORIGIN:'http://127.0.0.1:5173'});
    const app=createApp(pool,config);
    const origin=config.APP_ORIGIN;
    const leader=request.agent(app),clerk=request.agent(app);
    const memberBody={characterName:'Phase3-Fixture',jobClass:'Alchemist',
      guildRole:'Elite',combatRole:'DPS',memberStatus:'ACTIVE',joinedOn:null};
    const eventRoot='/api/management/attendance/events';
    const caseRoot='/api/management/action-cases';
    const pw='sample-phase3-test-only-long-pass';
    async function clear(){
      await db.delete(memberActionAudit);
      await db.delete(memberActionNotes);
      await db.delete(memberActionCases);
      await db.delete(attendanceAssessmentHistory);
      await db.delete(attendanceAssessments);
      await db.delete(attendanceObservationCorrections);
      await db.delete(attendanceObservations);
      await db.delete(attendanceCheckpoints);
      await db.delete(attendanceEvents);
      await db.delete(weeklyGrCorrections);await db.delete(weeklyGearRatings);
      await db.delete(memberAliases);await db.delete(memberChanges);await db.delete(members);
      await db.delete(officerSessions);await db.delete(officerAudit);await db.delete(officerAccounts);
    }
    try{
      await clear();
      await request(app).get(eventRoot).expect(401);
      await request(app).get(caseRoot).expect(401);
      await db.insert(officerAccounts).values([
        {username:'leader',displayName:'Leader',role:'GUILD_LEADER',passwordHash:await hashPassword(pw),mustChangePassword:false},
        {username:'clerk',displayName:'Clerk',role:'CLERK',passwordHash:await hashPassword(pw),mustChangePassword:false}
      ]);
      await leader.post('/api/auth/login').set('Origin',origin).send({username:'leader',password:pw}).expect(200);
      await clerk.post('/api/auth/login').set('Origin',origin).send({username:'clerk',password:pw}).expect(200);
      await clerk.get(caseRoot).expect(403);
      await clerk.get(eventRoot).expect(200);
      await leader.post('/api/management/members').set('Origin',origin).send(memberBody).expect(201);
      const [member]=await db.select({id:members.id}).from(members);
      const eventData={eventType:'GUILD_LEAGUE',title:'Guild League Test Session',
        startsAt:'2026-11-10T20:00:00+08:00'};
      await clerk.post(eventRoot).send(eventData).expect(403);
      const eventResult=await clerk.post(eventRoot).set('Origin',origin).send(eventData).expect(201);
      const eventId=eventResult.body.event.id as string;
      const cpPath=`${eventRoot}/${eventId}/checkpoints`;
      const before=await clerk.post(cpPath).set('Origin',origin).send({
        phase:'BEFORE',capturedAt:'2026-11-10T19:55:00+08:00',
        evidenceRef:'before-partial-p1.png',coverage:'PARTIAL'
      }).expect(201);
      const beforeId=before.body.checkpoint.id as string;
      const observationsPath=`${cpPath}/${beforeId}/observations`;
      await clerk.post(observationsPath).set('Origin',origin).send({
        reviewed:false,observations:[{memberId:member.id,status:'OFFLINE'}]
      }).expect(400);
      await clerk.post(observationsPath).set('Origin',origin).send({
        reviewed:true,observations:[{memberId:member.id,status:'OFFLINE'}]
      }).expect(201);
      await clerk.post(observationsPath).set('Origin',origin).send({
        reviewed:true,observations:[{memberId:member.id,status:'OFFLINE'}]
      }).expect(409);
      const detail=await clerk.get(`${eventRoot}/${eventId}`).expect(200);
      assert.equal(detail.body.checkpoints.length,1);
      assert.equal(detail.body.observations[0].status,'OFFLINE');
      const observationId=detail.body.observations[0].id as string;
      await clerk.patch(`${observationsPath}/${observationId}`).set('Origin',origin).send({
        status:'UNKNOWN',version:1,reason:'Screenshot text was unclear'
      }).expect(200);
      assert.equal((await db.select().from(attendanceObservationCorrections)).length,1);
      await clerk.get(`${eventRoot}/${eventId}/assessments`).expect(403);
      await clerk.post(`${eventRoot}/${eventId}/assessments`).set('Origin',origin).send({
        memberId:member.id,assessment:'LIKELY_ABSENT',rationale:'No participation shown in partial image',
        verificationMethod:null,evidenceRef:null
      }).expect(403);
      const assessed=`${eventRoot}/${eventId}/assessments`;
      await leader.post(assessed).set('Origin',origin).send({
        memberId:member.id,assessment:'LIKELY_ABSENT',
        rationale:'Only partial roster evidence was available',
        verificationMethod:null,evidenceRef:null
      }).expect(422);
      await leader.post(assessed).set('Origin',origin).send({
        memberId:member.id,assessment:'CONFIRMED_PARTICIPATED',
        rationale:'Online was seen but no battle proof exists',verificationMethod:null,evidenceRef:null
      }).expect(400);
      await leader.post(assessed).set('Origin',origin).send({
        memberId:member.id,assessment:'NEEDS_REVIEW',rationale:'Partial screenshot; missing complete coverage',
        verificationMethod:null,evidenceRef:null
      }).expect(201);
      const beforeReview=(await leader.get(assessed).expect(200)).body.assessments[0];
      assert.equal(beforeReview.assessment,'NEEDS_REVIEW');
      await leader.patch(`${assessed}/${beforeReview.id}`).set('Origin',origin).send({
        memberId:member.id,assessment:'CONFIRMED_PARTICIPATED',
        rationale:'Verified against direct battle report by officer',
        verificationMethod:'BATTLE_REPORT',evidenceRef:'battle-report.png',version:1
      }).expect(200);
      assert.equal((await db.select().from(attendanceAssessmentHistory)).length,2);
      const record=await leader.post(caseRoot).set('Origin',origin).send({
        memberId:member.id,eventId,caseType:'AWOL_REVIEW',openingNote:'Manual review requested, not an automatic accusation',followUpOn:null
      }).expect(201);
      const caseId=record.body.case.id as string;
      await clerk.get(`${caseRoot}/${caseId}`).expect(403);
      await clerk.post(`${caseRoot}/${caseId}/notes`).set('Origin',origin).send({
        kind:'MEMBER_REPORT',content:'Personal leave',source:'Guild chat',reportedAt:null
      }).expect(403);
      await leader.post(`${caseRoot}/${caseId}/notes`).set('Origin',origin).send({
        kind:'MEMBER_REPORT',content:'Member reported unexpected conflict',source:null,reportedAt:null
      }).expect(400);
      await leader.post(`${caseRoot}/${caseId}/notes`).set('Origin',origin).send({
        kind:'MEMBER_REPORT',content:'Member reported unexpected conflict',source:'Guild direct message',reportedAt:null
      }).expect(201);
      await leader.patch(`${caseRoot}/${caseId}`).set('Origin',origin).send({
        version:1,status:'UNEXCUSED',assignedOfficerId:null,followUpOn:null,officerDetermination:null
      }).expect(400);
      await leader.patch(`${caseRoot}/${caseId}`).set('Origin',origin).send({
        version:1,status:'IN_REVIEW',assignedOfficerId:null,followUpOn:'2026-11-17',
        officerDetermination:null
      }).expect(200);
      await leader.patch(`${caseRoot}/${caseId}`).set('Origin',origin).send({
        version:1,status:'RESOLVED',assignedOfficerId:null,followUpOn:null,
        officerDetermination:'Investigated and closed after guild discussion'
      }).expect(409);
      const caseDetail=await leader.get(`${caseRoot}/${caseId}`).expect(200);
      assert.equal(caseDetail.body.notes.length,2);
      assert.equal(caseDetail.body.audit.length,3);
      assert.equal(caseDetail.body.case.status,'IN_REVIEW');
      await leader.get(caseRoot).expect(200);
      assert.equal((await clerk.get(`${eventRoot}/${eventId}`).expect(200)).body.assessments,undefined);
      assert.equal((await db.select().from(attendanceObservations)).length,1);
    }finally{await clear();await pool.end();}
  });
