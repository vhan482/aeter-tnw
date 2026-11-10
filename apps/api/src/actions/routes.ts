import type { Express } from 'express';
import type pg from 'pg';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { z } from 'zod';
import { attendanceEvents, memberActionAudit, memberActionCases, memberActionNotes, members,
  officerAccounts } from '../db/schema.js';
import { actor, conflict, handleConstraint, invalid, noStore, notFound, reviewerOnly, wrap, type Guards } from '../ops/common.js';

const uuid=z.string().uuid();
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{
  const d=new Date(v+'T00:00:00Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
});
const types=z.enum(['ABSENCE_FOLLOWUP','AFK_REPORT','AWOL_REVIEW','GENERAL']);
const statuses=z.enum(['OPEN','AWAITING_RESPONSE','IN_REVIEW','EXCUSED','UNEXCUSED','ESCALATED','RESOLVED']);
const createBody=z.object({
  memberId:uuid,eventId:uuid.nullable().default(null),caseType:types,
  openingNote:z.string().trim().min(8).max(3000),
  followUpOn:isoDate.nullable().default(null)
}).strict();
const updateBody=z.object({
  version:z.number().int().min(1),
  status:statuses,
  assignedOfficerId:uuid.nullable(),
  followUpOn:isoDate.nullable(),
  officerDetermination:z.string().trim().max(3000).nullable()
}).strict().superRefine((value,ctx)=>{
  if(['EXCUSED','UNEXCUSED','ESCALATED'].includes(value.status) && (!value.officerDetermination||value.officerDetermination.length<8)) {
    ctx.addIssue({code:'custom',path:['officerDetermination'],message:'An officer determination is required'});
  }
});
const noteBody=z.object({
  kind:z.enum(['MEMBER_REPORT','OFFICER_NOTE']),
  content:z.string().trim().min(3).max(3000),
  source:z.string().trim().min(2).max(160).nullable().default(null),
  reportedAt:z.string().datetime({offset:true}).nullable().default(null)
}).strict().superRefine((value,ctx)=>{
  if(value.kind==='MEMBER_REPORT'&&!value.source)
    ctx.addIssue({code:'custom',path:['source'],message:'A member report needs its communication source'});
});
function caseSnapshot(row: {
  status:string;assignedOfficerId:string|null;followUpOn:string|null;officerDetermination:string|null
}){
  return {status:row.status,assignedOfficerId:row.assignedOfficerId,
    followUpOn:row.followUpOn,officerDetermination:row.officerDetermination};
}

export function registerActionCenterRoutes(app:Express,pool:pg.Pool,guards:Guards){
  const db=drizzle(pool),root='/api/management/action-cases';
  app.use(root,noStore,guards.authenticate,guards.ready,reviewerOnly);

  app.get(root,wrap(async(_req,res)=>{
    const cases=await db.select({
      id:memberActionCases.id,memberId:memberActionCases.memberId,
      characterName:members.characterName,eventId:memberActionCases.eventId,
      caseType:memberActionCases.caseType,status:memberActionCases.status,
      assignedOfficerId:memberActionCases.assignedOfficerId,followUpOn:memberActionCases.followUpOn,
      version:memberActionCases.version,createdAt:memberActionCases.createdAt,
      updatedAt:memberActionCases.updatedAt
    }).from(memberActionCases).innerJoin(members,eq(memberActionCases.memberId,members.id))
      .orderBy(desc(memberActionCases.updatedAt)).limit(200);
    res.json({cases});
  }));
  app.post(root,guards.csrf,wrap(async(req,res)=>{
    const p=createBody.safeParse(req.body);if(!p.success){invalid(res);return;}
    const [m]=await db.select({id:members.id}).from(members).where(eq(members.id,p.data.memberId)).limit(1);
    if(!m){notFound(res);return;}
    if(p.data.eventId){
      const [e]=await db.select({id:attendanceEvents.id}).from(attendanceEvents)
        .where(eq(attendanceEvents.id,p.data.eventId)).limit(1);
      if(!e){notFound(res);return;}
    }
    const result=await db.transaction(async tx=>{
      const [row]=await tx.insert(memberActionCases).values({
        memberId:p.data.memberId,eventId:p.data.eventId,
        caseType:p.data.caseType,followUpOn:p.data.followUpOn,
        status:'OPEN',createdBy:actor(res).id,assignedOfficerId:actor(res).id
      }).returning();
      await tx.insert(memberActionNotes).values({
        caseId:row.id,kind:'OFFICER_NOTE',content:p.data.openingNote,authorId:actor(res).id
      });
      await tx.insert(memberActionAudit).values({
        caseId:row.id,action:'CASE_CREATED',actorId:actor(res).id,
        before:null,after:{...caseSnapshot(row),caseType:row.caseType,
          openingNoteRecorded:true}
      });
      return row;
    });
    res.status(201).json({case:result});
  }));
  app.get(root+'/:id',wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id);if(!id.success){invalid(res);return;}
    const [record]=await db.select().from(memberActionCases)
      .where(eq(memberActionCases.id,id.data)).limit(1);
    if(!record){notFound(res);return;}
    const notes=await db.select().from(memberActionNotes).where(eq(memberActionNotes.caseId,id.data))
      .orderBy(asc(memberActionNotes.createdAt),asc(memberActionNotes.id));
    const audit=await db.select().from(memberActionAudit).where(eq(memberActionAudit.caseId,id.data))
      .orderBy(asc(memberActionAudit.createdAt),asc(memberActionAudit.id));
    res.json({case:record,notes,audit});
  }));
  app.post(root+'/:id/notes',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),p=noteBody.safeParse(req.body);
    if(!id.success||!p.success){invalid(res);return;}
    const result=await db.transaction(async tx=>{
      const [record]=await tx.select({id:memberActionCases.id}).from(memberActionCases)
        .where(eq(memberActionCases.id,id.data)).limit(1);
      if(!record)return null;
      const [note]=await tx.insert(memberActionNotes).values({
        caseId:id.data,kind:p.data.kind,content:p.data.content,source:p.data.source,
        reportedAt:p.data.reportedAt?new Date(p.data.reportedAt):null,authorId:actor(res).id
      }).returning();
      await tx.insert(memberActionAudit).values({
        caseId:id.data,action:'NOTE_ADDED',actorId:actor(res).id,
        before:null,after:{noteId:note.id,kind:note.kind,source:note.source}
      });
      return note;
    });
    if(!result){notFound(res);return;}
    res.status(201).json({note:result});
  }));
  app.patch(root+'/:id',guards.csrf,wrap(async(req,res)=>{
    const id=uuid.safeParse(req.params.id),p=updateBody.safeParse(req.body);
    if(!id.success||!p.success){invalid(res);return;}
    const {version,...updates}=p.data;
    if(updates.assignedOfficerId){
      const [account]=await db.select({id:officerAccounts.id}).from(officerAccounts)
        .where(and(eq(officerAccounts.id,updates.assignedOfficerId),eq(officerAccounts.active,true))).limit(1);
      if(!account){invalid(res);return;}
      const [role]=await db.select({role:officerAccounts.role}).from(officerAccounts)
        .where(eq(officerAccounts.id,updates.assignedOfficerId)).limit(1);
      if(!role || role.role==='CLERK'){invalid(res);return;}
    }
    const result=await db.transaction(async tx=>{
      const [before]=await tx.select().from(memberActionCases).where(eq(memberActionCases.id,id.data)).limit(1);
      if(!before)return null;
      if(before.version!==version)return 'conflict' as const;
      const [after]=await tx.update(memberActionCases).set({
        ...updates,version:sql`${memberActionCases.version}+1`,updatedAt:new Date()
      }).where(and(eq(memberActionCases.id,id.data),eq(memberActionCases.version,version))).returning();
      if(!after)return 'conflict' as const;
      await tx.insert(memberActionAudit).values({
        caseId:id.data,action:'CASE_UPDATED',actorId:actor(res).id,
        before:caseSnapshot(before),after:caseSnapshot(after)
      });
      return after;
    });
    if(result===null){notFound(res);return;}
    if(result==='conflict'){conflict(res);return;}
    res.json({case:result});
  }));
}
