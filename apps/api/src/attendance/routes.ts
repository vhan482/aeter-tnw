import type { Express } from 'express';
import type pg from 'pg';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { attendanceEvents, attendanceCheckpoints, attendanceObservations,
  attendanceObservationCorrections, attendanceAssessments, attendanceAssessmentHistory, members } from '../db/schema.js';
import { actor, conflict, handleConstraint, invalid, noStore, notFound, reviewerOnly, wrap, type Guards } from '../ops/common.js';

const uuid=z.string().uuid();
const instant=z.string().datetime({offset:true});
const eventBody=z.object({
  eventType:z.enum(['GUILD_LEAGUE','HAZY_FOREST','GUILD_SIEGE']),
  title:z.string().trim().min(3).max(160),
  startsAt:instant
}).strict();
const checkpointBody=z.object({
  phase:z.enum(['BEFORE','DURING','AFTER']),
  capturedAt:instant,
  evidenceRef:z.string().trim().min(3).max(255),
  coverage:z.enum(['COMPLETE','PARTIAL','UNKNOWN'])
}).strict();
const observationStatus=z.enum(['ONLINE','OFFLINE','UNKNOWN']);
const observationBatch=z.object({
  reviewed:z.literal(true),
  observations:z.array(z.object({memberId:uuid,status:observationStatus}).strict()).min(1).max(250)
}).strict();
const observationCorrection=z.object({
  status:observationStatus,
  version:z.number().int().min(1),
  reason:z.string().trim().min(5).max(1000)
}).strict();
const assessmentValues=z.object({
  memberId:uuid,
  assessment:z.enum(['CONFIRMED_PARTICIPATED','LIKELY_PRESENT','LIKELY_ABSENT','NEEDS_REVIEW']),
  rationale:z.string().trim().min(8).max(1600),
  verificationMethod:z.enum(['BATTLE_REPORT','OFFICER_CONFIRMATION']).nullable().default(null),
  evidenceRef:z.string().trim().max(255).nullable().default(null)
}).strict().superRefine((value,ctx)=>{
  if(value.assessment==='CONFIRMED_PARTICIPATED' && (!value.verificationMethod || !value.evidenceRef)){
    ctx.addIssue({code:'custom',message:'Direct verification and evidence required',path:['evidenceRef']});
  }
});
const assessmentUpdate=z.object({
  memberId:uuid,assessment:z.enum(['CONFIRMED_PARTICIPATED','LIKELY_PRESENT','LIKELY_ABSENT','NEEDS_REVIEW']),
  rationale:z.string().trim().min(8).max(1600),
  verificationMethod:z.enum(['BATTLE_REPORT','OFFICER_CONFIRMATION']).nullable(),
  evidenceRef:z.string().trim().max(255).nullable(),
  version:z.number().int().min(1)
}).strict().superRefine((value,ctx)=>{
  if(value.assessment==='CONFIRMED_PARTICIPATED'&&(!value.verificationMethod||!value.evidenceRef)){
    ctx.addIssue({code:'custom',message:'Direct verification and evidence required',path:['evidenceRef']});
  }
});

export function registerAttendanceRoutes(app:Express,pool:pg.Pool,guards:Guards){
  const db=drizzle(pool),root='/api/management/attendance';
  app.use(root,noStore,guards.authenticate,guards.ready);

  app.get(root+'/events',wrap(async(_req,res)=>{
    const events=await db.select().from(attendanceEvents).orderBy(desc(attendanceEvents.startsAt)).limit(100);
    res.json({events});
  }));
  app.post(root+'/events',guards.csrf,wrap(async(req,res)=>{
    const parsed=eventBody.safeParse(req.body);
    if(!parsed.success){invalid(res);return;}
    const [event]=await db.insert(attendanceEvents).values({
      ...parsed.data,startsAt:new Date(parsed.data.startsAt),createdBy:actor(res).id
    }).returning();
    res.status(201).json({event});
  }));

  app.get(root+'/events/:id',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success){invalid(res);return;}
    const [event]=await db.select().from(attendanceEvents).where(eq(attendanceEvents.id,id.data)).limit(1);
    if(!event){notFound(res);return;}
    const checkpoints=await db.select().from(attendanceCheckpoints)
      .where(eq(attendanceCheckpoints.eventId,id.data))
      .orderBy(asc(attendanceCheckpoints.capturedAt));
    const observations=checkpoints.length ? await db.select({
      id:attendanceObservations.id,checkpointId:attendanceObservations.checkpointId,
      memberId:attendanceObservations.memberId,status:attendanceObservations.status,
      version:attendanceObservations.version,reviewedAt:attendanceObservations.reviewedAt,
      characterName:members.characterName
    }).from(attendanceObservations).innerJoin(members,eq(attendanceObservations.memberId,members.id))
      .where(inArray(attendanceObservations.checkpointId,checkpoints.map(c=>c.id)))
      .orderBy(asc(members.characterName)):[];
    // No officer assessments/notes are returned from this shared clerk view.
    res.json({event,checkpoints,observations});
  }));

  app.post(root+'/events/:id/checkpoints',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=checkpointBody.safeParse(req.body);
    if(!id.success||!parsed.success){invalid(res);return;}
    const exists=await db.select({id:attendanceEvents.id}).from(attendanceEvents).where(eq(attendanceEvents.id,id.data)).limit(1);
    if(!exists.length){notFound(res);return;}
    try{
      const [checkpoint]=await db.insert(attendanceCheckpoints).values({
        eventId:id.data,phase:parsed.data.phase,capturedAt:new Date(parsed.data.capturedAt),
        evidenceRef:parsed.data.evidenceRef,coverage:parsed.data.coverage,createdBy:actor(res).id
      }).returning();
      res.status(201).json({checkpoint});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.post(root+'/events/:id/checkpoints/:checkpointId/observations',guards.csrf,wrap(async(req,res)=>{
    const eventId=uuid.safeParse(req.params.id),checkId=uuid.safeParse(req.params.checkpointId);
    const parsed=observationBatch.safeParse(req.body);
    if(!eventId.success||!checkId.success||!parsed.success){invalid(res);return;}
    const [checkpoint]=await db.select().from(attendanceCheckpoints)
      .where(and(eq(attendanceCheckpoints.id,checkId.data),eq(attendanceCheckpoints.eventId,eventId.data))).limit(1);
    if(!checkpoint){notFound(res);return;}
    const items=parsed.data.observations;
    const ids=items.map(item=>item.memberId);
    if(new Set(ids).size!==ids.length){conflict(res);return;}
    const found=await db.select({id:members.id}).from(members).where(inArray(members.id,ids));
    if(found.length!==ids.length){invalid(res);return;}
    try{
      const rows=await db.insert(attendanceObservations).values(items.map(item=>({
        ...item,checkpointId:checkId.data,reviewedBy:actor(res).id
      }))).returning();
      res.status(201).json({observations:rows});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.patch(root+'/events/:id/checkpoints/:checkpointId/observations/:observationId',guards.csrf,wrap(async(req,res)=>{
    const e=uuid.safeParse(req.params.id),c=uuid.safeParse(req.params.checkpointId),
      id=uuid.safeParse(req.params.observationId),p=observationCorrection.safeParse(req.body);
    if(!e.success||!c.success||!id.success||!p.success){invalid(res);return;}
    const result=await db.transaction(async tx=>{
      const [checkpoint]=await tx.select({id:attendanceCheckpoints.id}).from(attendanceCheckpoints)
        .where(and(eq(attendanceCheckpoints.id,c.data),eq(attendanceCheckpoints.eventId,e.data))).limit(1);
      if(!checkpoint)return null;
      const [before]=await tx.select().from(attendanceObservations)
        .where(and(eq(attendanceObservations.id,id.data),eq(attendanceObservations.checkpointId,c.data))).limit(1);
      if(!before)return null;
      if(before.version!==p.data.version)return 'conflict' as const;
      if(before.status===p.data.status)return 'unchanged' as const;
      const [after]=await tx.update(attendanceObservations).set({
        status:p.data.status,version:sql`${attendanceObservations.version}+1`,
        reviewedBy:actor(res).id,reviewedAt:new Date()
      }).where(and(eq(attendanceObservations.id,id.data),eq(attendanceObservations.version,p.data.version))).returning();
      if(!after)return 'conflict' as const;
      await tx.insert(attendanceObservationCorrections).values({
        observationId:id.data,beforeStatus:before.status,afterStatus:after.status,
        reason:p.data.reason,correctedBy:actor(res).id
      });
      return after;
    });
    if(result===null){notFound(res);return;}
    if(result==='conflict'){conflict(res);return;}
    if(result==='unchanged'){res.status(409).json({error:'No observation change provided'});return;}
    res.json({observation:result});
  }));

  app.get(root+'/events/:id/assessments',reviewerOnly,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success){invalid(res);return;}
    const rows=await db.select().from(attendanceAssessments)
      .where(eq(attendanceAssessments.eventId,id.data)).orderBy(desc(attendanceAssessments.reviewedAt));
    res.json({assessments:rows});
  }));
  async function evidencePermits(eventId:string,memberId:string,status:string){
    if(status==='NEEDS_REVIEW'||status==='CONFIRMED_PARTICIPATED')return true;
    const rows=await db.select({phase:attendanceCheckpoints.phase,
      coverage:attendanceCheckpoints.coverage,status:attendanceObservations.status
    }).from(attendanceObservations)
      .innerJoin(attendanceCheckpoints,eq(attendanceObservations.checkpointId,attendanceCheckpoints.id))
      .where(and(eq(attendanceCheckpoints.eventId,eventId),eq(attendanceObservations.memberId,memberId)));
    if(status==='LIKELY_PRESENT')return rows.some(r=>r.status==='ONLINE');
    // Partial pages and any missing member observation mean no "likely absent".
    return ['BEFORE','DURING','AFTER'].every(phase=>rows.some(r=>
      r.phase===phase&&r.coverage==='COMPLETE'&&r.status==='OFFLINE')) &&
      !rows.some(r=>r.status==='ONLINE');
  }
  app.post(root+'/events/:id/assessments',guards.csrf,reviewerOnly,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=assessmentValues.safeParse(req.body);
    if(!id.success||!parsed.success){invalid(res);return;}
    const [event]=await db.select({id:attendanceEvents.id}).from(attendanceEvents)
      .where(eq(attendanceEvents.id,id.data)).limit(1);
    const [member]=await db.select({id:members.id}).from(members)
      .where(eq(members.id,parsed.data.memberId)).limit(1);
    if(!event||!member){notFound(res);return;}
    if(!await evidencePermits(id.data,parsed.data.memberId,parsed.data.assessment)){
      res.status(422).json({error:'Checkpoint evidence is insufficient for this assessment'});return;
    }
    try{
      const assessment=await db.transaction(async tx=>{
        const [row]=await tx.insert(attendanceAssessments).values({
          eventId:id.data,...parsed.data,reviewedBy:actor(res).id
        }).returning();
        await tx.insert(attendanceAssessmentHistory).values({
          assessmentId:row.id,before:null,after:parsed.data,changedBy:actor(res).id
        });
        return row;
      });
      res.status(201).json({assessment});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.patch(root+'/events/:id/assessments/:assessmentId',guards.csrf,reviewerOnly,wrap(async(req,res)=>{
    const e=uuid.safeParse(req.params.id),id=uuid.safeParse(req.params.assessmentId);
    const p=assessmentUpdate.safeParse(req.body);
    if(!e.success||!id.success||!p.success){invalid(res);return;}
    if(!await evidencePermits(e.data,p.data.memberId,p.data.assessment)){
      res.status(422).json({error:'Checkpoint evidence is insufficient for this assessment'});return;
    }
    const {version,...updates}=p.data;
    const result=await db.transaction(async tx=>{
      const [before]=await tx.select().from(attendanceAssessments).where(and(
        eq(attendanceAssessments.eventId,e.data),eq(attendanceAssessments.id,id.data),
        eq(attendanceAssessments.memberId,updates.memberId))).limit(1);
      if(!before)return null;
      if(before.version!==version)return 'conflict' as const;
      const [after]=await tx.update(attendanceAssessments).set({
        assessment:updates.assessment,rationale:updates.rationale,
        verificationMethod:updates.verificationMethod,evidenceRef:updates.evidenceRef,
        reviewedBy:actor(res).id,reviewedAt:new Date(),version:sql`${attendanceAssessments.version}+1`
      }).where(and(eq(attendanceAssessments.id,id.data),eq(attendanceAssessments.version,version))).returning();
      if(!after)return 'conflict' as const;
      await tx.insert(attendanceAssessmentHistory).values({
        assessmentId:id.data,changedBy:actor(res).id,
        before:{assessment:before.assessment,rationale:before.rationale,
          verificationMethod:before.verificationMethod,evidenceRef:before.evidenceRef},
        after:updates
      });
      return after;
    });
    if(result===null){notFound(res);return;}
    if(result==='conflict'){conflict(res);return;}
    res.json({assessment:result});
  }));
}
