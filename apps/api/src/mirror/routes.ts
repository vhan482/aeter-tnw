import type { Express } from 'express';
import type pg from 'pg';
import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { members, mirrorWorldBosses, mirrorWorldSessions, mirrorWorldResults,
  mirrorWorldResultHistory } from '../db/schema.js';
import { actor, conflict, handleConstraint, invalid, noStore, notFound,
  reviewerOnly, wrap, type Guards } from '../ops/common.js';
import { estimateAverageDps, parseDamageDisplay } from './damage.js';

const base = '/api/management/mirror-world';
const uuid = z.string().uuid();
const optionalName = (length: number) => z.string().trim().min(1).max(length).nullable().default(null);
const bossBody = z.object({
  name: z.string().trim().min(1).max(100),
  race: optionalName(50),size:optionalName(50),element:optionalName(50),
  elementLevel:z.number().int().min(1).max(10).nullable().default(null)
}).strict();
const sessionBody = z.object({
  bossId:uuid,
  startsAt:z.string().datetime({offset:true}),
  durationSeconds:z.number().int().min(60).max(7200).default(900),
  rotation:optionalName(80)
}).strict();
const resultFields = z.object({
  memberId:uuid,
  rank:z.number().int().min(1).max(500).nullable(),
  damageRaw:z.string().trim().min(1).max(32),
  sourceReference:z.string().trim().min(3).max(255),
  evidenceUploadId:uuid.nullable().default(null),
  reviewed:z.literal(true)
}).strict();
const editFields = resultFields.extend({
  version:z.number().int().min(1),
  reason:z.string().trim().min(5).max(1000)
}).strict();

export function registerMirrorWorldRoutes(app:Express,pool:pg.Pool,guards:Guards) {
  const db=drizzle(pool);
  app.use(base,noStore,guards.authenticate,guards.ready);

  app.get(base+'/bosses',wrap(async(_req,res)=>{
    const bosses=await db.select().from(mirrorWorldBosses).orderBy(mirrorWorldBosses.name).limit(250);
    res.json({bosses});
  }));

  app.post(base+'/bosses',guards.csrf,reviewerOnly,wrap(async(req,res)=>{
    const body=bossBody.safeParse(req.body);
    if(!body.success){invalid(res);return;}
    try{
      const [boss]=await db.insert(mirrorWorldBosses).values({...body.data,createdBy:actor(res).id}).returning();
      res.status(201).json({boss});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.get(base+'/sessions',wrap(async(_req,res)=>{
    const sessions=await db.select({
      id:mirrorWorldSessions.id,bossId:mirrorWorldSessions.bossId,
      bossName:mirrorWorldBosses.name,startsAt:mirrorWorldSessions.startsAt,
      durationSeconds:mirrorWorldSessions.durationSeconds,
      rotation:mirrorWorldSessions.rotation
    }).from(mirrorWorldSessions)
      .innerJoin(mirrorWorldBosses,eq(mirrorWorldSessions.bossId,mirrorWorldBosses.id))
      .orderBy(desc(mirrorWorldSessions.startsAt)).limit(100);
    res.json({sessions});
  }));

  app.post(base+'/sessions',guards.csrf,wrap(async(req,res)=>{
    const body=sessionBody.safeParse(req.body);
    if(!body.success){invalid(res);return;}
    const [boss]=await db.select({id:mirrorWorldBosses.id}).from(mirrorWorldBosses)
      .where(eq(mirrorWorldBosses.id,body.data.bossId)).limit(1);
    if(!boss){notFound(res);return;}
    const [session]=await db.insert(mirrorWorldSessions).values({
      bossId:body.data.bossId,startsAt:new Date(body.data.startsAt),
      durationSeconds:body.data.durationSeconds,rotation:body.data.rotation,
      createdBy:actor(res).id
    }).returning();
    res.status(201).json({session});
  }));

  async function sessionDetail(id:string) {
    const [session]=await db.select({
      id:mirrorWorldSessions.id,bossId:mirrorWorldSessions.bossId,
      bossName:mirrorWorldBosses.name,startsAt:mirrorWorldSessions.startsAt,
      durationSeconds:mirrorWorldSessions.durationSeconds,
      rotation:mirrorWorldSessions.rotation
    }).from(mirrorWorldSessions)
      .innerJoin(mirrorWorldBosses,eq(mirrorWorldSessions.bossId,mirrorWorldBosses.id))
      .where(eq(mirrorWorldSessions.id,id)).limit(1);
    return session;
  }

  app.get(base+'/sessions/:id',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id);
    if(!id.success){invalid(res);return;}
    const session=await sessionDetail(id.data);
    if(!session){notFound(res);return;}
    const rows=await db.select({result:mirrorWorldResults,characterName:members.characterName})
      .from(mirrorWorldResults)
      .innerJoin(members,eq(mirrorWorldResults.memberId,members.id))
      .where(eq(mirrorWorldResults.sessionId,id.data))
      .orderBy(mirrorWorldResults.rank,mirrorWorldResults.reviewedAt)
      .limit(500);
    const results=rows.map(({result,characterName})=>({
      ...result,characterName,
      averageDpsEstimate:estimateAverageDps(result.damageEstimate,session.durationSeconds)
    }));
    res.json({session,results});
  }));

  app.post(base+'/sessions/:id/results',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),body=resultFields.safeParse(req.body);
    if(!id.success||!body.success){invalid(res);return;}
    const parsed=parseDamageDisplay(body.data.damageRaw);
    if(!parsed){res.status(422).json({error:'Unrecognized damage display; review the screenshot value'});return;}
    const [session]=await db.select({id:mirrorWorldSessions.id}).from(mirrorWorldSessions)
      .where(eq(mirrorWorldSessions.id,id.data)).limit(1);
    if(!session){notFound(res);return;}
    const [member]=await db.select({id:members.id}).from(members)
      .where(eq(members.id,body.data.memberId)).limit(1);
    if(!member){notFound(res);return;}
    try{
      const [result]=await db.insert(mirrorWorldResults).values({
        sessionId:id.data,memberId:body.data.memberId,rank:body.data.rank,
        damageRaw:body.data.damageRaw,damageEstimate:parsed.normalized,
        approximate:parsed.approximate,sourceReference:body.data.sourceReference,
        evidenceUploadId:body.data.evidenceUploadId,reviewedBy:actor(res).id
      }).returning();
      res.status(201).json({result});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.patch(base+'/sessions/:id/results/:resultId',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),resultId=uuid.safeParse(req.params.resultId);
    const body=editFields.safeParse(req.body);
    if(!id.success||!resultId.success||!body.success){invalid(res);return;}
    const parsed=parseDamageDisplay(body.data.damageRaw);
    if(!parsed){res.status(422).json({error:'Unrecognized damage display; review the screenshot value'});return;}
    try{
      const updated=await db.transaction(async tx=>{
        const [before]=await tx.select().from(mirrorWorldResults).where(and(
          eq(mirrorWorldResults.id,resultId.data),eq(mirrorWorldResults.sessionId,id.data))).limit(1);
        if(!before)return null;
        if(before.version!==body.data.version)return 'conflict' as const;
        const [after]=await tx.update(mirrorWorldResults).set({
          memberId:body.data.memberId,rank:body.data.rank,damageRaw:body.data.damageRaw,
          damageEstimate:parsed.normalized,approximate:parsed.approximate,
          sourceReference:body.data.sourceReference,evidenceUploadId:body.data.evidenceUploadId,
          reviewedBy:actor(res).id,reviewedAt:new Date(),
          version:sql`${mirrorWorldResults.version}+1`
        }).where(and(eq(mirrorWorldResults.id,resultId.data),
          eq(mirrorWorldResults.version,body.data.version))).returning();
        if(!after)return 'conflict' as const;
        await tx.insert(mirrorWorldResultHistory).values({
          resultId:before.id,before:{
            memberId:before.memberId,rank:before.rank,damageRaw:before.damageRaw,
            sourceReference:before.sourceReference,evidenceUploadId:before.evidenceUploadId
          },after:{
            memberId:after.memberId,rank:after.rank,damageRaw:after.damageRaw,
            sourceReference:after.sourceReference,evidenceUploadId:after.evidenceUploadId
          },reason:body.data.reason,changedBy:actor(res).id
        });
        return after;
      });
      if(updated===null){notFound(res);return;}
      if(updated==='conflict'){conflict(res);return;}
      res.json({result:updated});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.get(base+'/sessions/:id/results/:resultId/history',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),resultId=uuid.safeParse(req.params.resultId);
    if(!id.success||!resultId.success){invalid(res);return;}
    const [result]=await db.select({id:mirrorWorldResults.id}).from(mirrorWorldResults).where(and(
      eq(mirrorWorldResults.id,resultId.data),eq(mirrorWorldResults.sessionId,id.data))).limit(1);
    if(!result){notFound(res);return;}
    const changes=await db.select().from(mirrorWorldResultHistory)
      .where(eq(mirrorWorldResultHistory.resultId,resultId.data))
      .orderBy(desc(mirrorWorldResultHistory.changedAt)).limit(100);
    res.json({changes});
  }));
}
