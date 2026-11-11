import type { Express } from 'express';
import type pg from 'pg';
import { and, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { leagueMatches, leaguePlayerTabResults, leaguePlayerTabHistory, members } from '../db/schema.js';
import { actor, conflict, handleConstraint, invalid, noStore, notFound, wrap, type Guards } from '../ops/common.js';
import { leagueObservation } from './validation.js';
import { mergeLeagueRows, type LeagueTabRow, type LeagueTab, type LeagueBattlefield } from './metrics.js';

const base='/api/management/league';
const uuid=z.string().uuid();
const matchInput=z.object({
  opponentGuild:z.string().trim().min(1).max(128),
  occurredAt:z.string().datetime({offset:true}),
  stage:z.enum(['PRELIMINARY','SEMIFINAL','FINAL','OTHER']).nullable().default(null),
  result:z.enum(['WIN','LOSS','DRAW']).nullable().default(null)
}).strict();
const editInput=z.object({
  value:leagueObservation,
  version:z.number().int().min(1),
  reason:z.string().trim().min(5).max(1000)
}).strict();

export function registerLeagueRoutes(app:Express,pool:pg.Pool,guards:Guards){
  const db=drizzle(pool);
  app.use(base,noStore,guards.authenticate,guards.ready);

  app.get(base+'/matches',wrap(async(_req,res)=>{
    const matches=await db.select().from(leagueMatches)
      .orderBy(desc(leagueMatches.occurredAt)).limit(100);
    res.json({matches});
  }));

  app.post(base+'/matches',guards.csrf,wrap(async(req,res)=>{
    const parsed=matchInput.safeParse(req.body);
    if(!parsed.success){invalid(res);return;}
    const {occurredAt,...data}=parsed.data;
    const [match]=await db.insert(leagueMatches).values({
      ...data,occurredAt:new Date(occurredAt),createdBy:actor(res).id
    }).returning();
    res.status(201).json({match});
  }));

  async function findMatch(id:string){
    const [match]=await db.select().from(leagueMatches)
      .where(eq(leagueMatches.id,id)).limit(1);
    return match;
  }

  app.get(base+'/matches/:id',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id);
    if(!id.success){invalid(res);return;}
    const match=await findMatch(id.data);
    if(!match){notFound(res);return;}
    const observed=await db.select({
      observation:leaguePlayerTabResults,characterName:members.characterName
    }).from(leaguePlayerTabResults)
      .innerJoin(members,eq(leaguePlayerTabResults.memberId,members.id))
      .where(eq(leaguePlayerTabResults.matchId,id.data))
      .orderBy(leaguePlayerTabResults.battlefield,leaguePlayerTabResults.tab,
        members.characterName).limit(1500);
    const rows:LeagueTabRow[]=observed.map(({observation:o,characterName})=>({
      id:o.id,memberId:o.memberId,characterName,
      battlefield:o.battlefield as LeagueBattlefield,tab:o.tab as LeagueTab,
      metrics:o.metrics,sourceReference:o.sourceReference,evidenceUploadId:o.evidenceUploadId,
      reviewedAt:o.reviewedAt,version:o.version
    }));
    res.json({match,observations:rows,players:mergeLeagueRows(rows),
      note:'Only Aeternum guild members with reviewed screenshot-tab rows are shown. Missing tabs do not imply zero or absence; DPS-tab damage is a total, not damage per second.'});
  }));

  app.post(base+'/matches/:id/tab-results',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),parsed=leagueObservation.safeParse(req.body);
    if(!id.success||!parsed.success){invalid(res);return;}
    const match=await findMatch(id.data);
    if(!match){notFound(res);return;}
    const [member]=await db.select({id:members.id}).from(members)
      .where(eq(members.id,parsed.data.memberId)).limit(1);
    if(!member){notFound(res);return;}
    try{
      const {reviewed,...body}=parsed.data;
      const [row]=await db.insert(leaguePlayerTabResults).values({
        matchId:id.data,...body,reviewedBy:actor(res).id
      }).returning();
      res.status(201).json({observation:row});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.patch(base+'/matches/:id/tab-results/:observationId',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),observationId=uuid.safeParse(req.params.observationId);
    const parsed=editInput.safeParse(req.body);
    if(!id.success||!observationId.success||!parsed.success){invalid(res);return;}
    const {value,version,reason}=parsed.data;
    try{
      const updated=await db.transaction(async tx=>{
        const [before]=await tx.select().from(leaguePlayerTabResults)
          .where(and(eq(leaguePlayerTabResults.id,observationId.data),
            eq(leaguePlayerTabResults.matchId,id.data))).limit(1);
        if(!before)return null;
        if(before.version!==version)return 'conflict' as const;
        if(before.memberId!==value.memberId||before.battlefield!==value.battlefield||
          before.tab!==value.tab)return 'conflict' as const;
        const [after]=await tx.update(leaguePlayerTabResults).set({
          metrics:value.metrics,sourceReference:value.sourceReference,
          evidenceUploadId:value.evidenceUploadId,reviewedBy:actor(res).id,
          reviewedAt:new Date(),version:sql`${leaguePlayerTabResults.version}+1`
        }).where(and(eq(leaguePlayerTabResults.id,observationId.data),
          eq(leaguePlayerTabResults.version,version))).returning();
        if(!after)return 'conflict' as const;
        const snapshot=(record:typeof before)=>({
          battlefield:record.battlefield,tab:record.tab,memberId:record.memberId,
          metrics:record.metrics,sourceReference:record.sourceReference,
          evidenceUploadId:record.evidenceUploadId,version:record.version
        });
        await tx.insert(leaguePlayerTabHistory).values({
          tabResultId:before.id,before:snapshot(before),after:snapshot(after),
          reason,changedBy:actor(res).id
        });
        return after;
      });
      if(updated===null){notFound(res);return;}
      if(updated==='conflict'){conflict(res);return;}
      res.json({observation:updated});
    }catch(error){if(!handleConstraint(error,res))throw error;}
  }));

  app.get(base+'/matches/:id/tab-results/:observationId/history',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),observationId=uuid.safeParse(req.params.observationId);
    if(!id.success||!observationId.success){invalid(res);return;}
    const [existing]=await db.select({id:leaguePlayerTabResults.id})
      .from(leaguePlayerTabResults).where(and(
        eq(leaguePlayerTabResults.id,observationId.data),
        eq(leaguePlayerTabResults.matchId,id.data))).limit(1);
    if(!existing){notFound(res);return;}
    const changes=await db.select().from(leaguePlayerTabHistory)
      .where(eq(leaguePlayerTabHistory.tabResultId,observationId.data))
      .orderBy(desc(leaguePlayerTabHistory.changedAt)).limit(100);
    res.json({changes});
  }));
}
