import type { Express, Request, Response, NextFunction } from 'express';
import type pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { z } from 'zod';
import { members, memberAliases, weeklyGearRatings, weeklyGrCorrections, memberChanges } from '../db/schema.js';

type Middleware = (req: Request, res: Response, next: NextFunction) => void;
type Officer = { id: string; role: 'GUILD_LEADER' | 'OFFICER' | 'CLERK' };
const statuses = z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'LEFT']);
const name = z.string().trim().min(1).max(128);
const optionalText = (max: number) => z.string().trim().max(max).nullable();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, { message: 'Invalid calendar date' });
const memberFields = z.object({
  characterName: name,
  jobClass: optionalText(80).default(null),
  guildRole: optionalText(80).default(null),
  combatRole: optionalText(40).default(null),
  memberStatus: statuses.default('ACTIVE'),
  joinedOn: isoDate.nullable().default(null)
}).strict();
const updateFields = memberFields.partial().extend({ version: z.number().int().min(1) }).strict()
  .refine(data => Object.keys(data).some(key => key !== 'version'), { message: 'No changes provided' });
const grShape = z.object({
  weekStart: isoDate,
  gearRating: z.number().int().min(1).max(2_000_000_000).nullable(),
  sourceReference: optionalText(255).default(null),
  verified: z.boolean(),
  capturedAt: z.string().datetime({ offset: true }).nullable().default(null)
}).strict();
function validateVerifiedGr(
  data: { gearRating: number | null; verified: boolean; sourceReference: string | null },
  ctx: z.RefinementCtx
) {
  if (data.gearRating !== null && (!data.verified || !data.sourceReference)) {
    ctx.addIssue({ code: 'custom', message: 'Verified GR requires a reviewed source reference', path: ['sourceReference'] });
  }
  if (data.gearRating === null && data.verified) {
    ctx.addIssue({ code: 'custom', message: 'Unknown GR cannot be verified', path: ['verified'] });
  }
}
const grBody = grShape.superRefine(validateVerifiedGr);
const correctionBody = grShape.omit({ weekStart: true })
  .extend({ version: z.number().int().min(1), reason: z.string().trim().min(5).max(1000) })
  .strict().superRefine(validateVerifiedGr);
const importMember = memberFields.extend({ legacyId: z.string().trim().min(1).max(80) }).strict();
const importBatch = z.object({ members: z.array(importMember).min(1).max(250) }).strict();
const uuid = z.string().uuid();
function getOfficer(res: Response): Officer { return res.locals.officer as Officer; }
function asyncHandler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
function validation(res: Response) { return res.status(400).json({ error: 'Invalid roster data' }); }
function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
function conflict(res: Response) { return res.status(409).json({ error: 'Record changed or already exists; reload before editing' }); }
function isUniqueViolation(error: unknown) {
  // Drizzle wraps PostgreSQL errors. Inspect only error codes, never SQL parameters,
  // so duplicate names/snapshots return 409 without exposing query contents.
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === 'object'; i++) {
    if ('code' in current && current.code === '23505') return true;
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}

/** All routes below inherit the existing server-side officer-session and first-login protections. */
export function registerRosterRoutes(
  app: Express, pool: pg.Pool,
  guards: { authenticate: Middleware; ready: Middleware; csrf: Middleware }
) {
  const db = drizzle(pool);
  const base = '/api/management/members';
  app.use(base, noStore, guards.authenticate, guards.ready);

  app.get(base, asyncHandler(async (req, res) => {
    const query = z.object({
      search: z.string().trim().max(100).default(''),
      limit: z.coerce.number().int().min(1).max(250).default(150),
      offset: z.coerce.number().int().min(0).max(10000).default(0)
    }).safeParse(req.query);
    if (!query.success) { validation(res); return; }
    const { search, limit, offset } = query.data;
    // Parameterized ILIKE prevents SQL injection; a literal-name search can be added later.
    const where = search ? ilike(members.characterName, '%' + search + '%') : undefined;
    const rows = await db.select().from(members).where(where)
      .orderBy(asc(members.characterName), asc(members.id)).limit(limit).offset(offset);
    const total = await db.select({ count: sql<number>`count(*)::int` }).from(members).where(where);
    res.json({ members: rows, total: total[0]?.count ?? 0 });
  }));

  app.get(base + '/:id/weekly-gr', asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) { validation(res); return; }
    const member = await db.select({ id: members.id }).from(members).where(eq(members.id, id.data)).limit(1);
    if (!member.length) { res.status(404).json({ error: 'Member not found' }); return; }
    const snapshots = await db.select().from(weeklyGearRatings)
      .where(eq(weeklyGearRatings.memberId, id.data)).orderBy(desc(weeklyGearRatings.weekStart));
    res.json({ snapshots });
  }));

  app.get(base + '/:id/weekly-gr/:snapshotId/corrections', asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id), snap = uuid.safeParse(req.params.snapshotId);
    if (!id.success || !snap.success) { validation(res); return; }
    const snapshot = await db.select({ id: weeklyGearRatings.id }).from(weeklyGearRatings)
      .where(and(eq(weeklyGearRatings.id, snap.data), eq(weeklyGearRatings.memberId, id.data))).limit(1);
    if (!snapshot.length) { res.status(404).json({ error: 'Snapshot not found' }); return; }
    const corrections = await db.select().from(weeklyGrCorrections)
      .where(eq(weeklyGrCorrections.snapshotId, snap.data)).orderBy(desc(weeklyGrCorrections.changedAt));
    res.json({ corrections });
  }));

  app.post(base, guards.csrf, asyncHandler(async (req, res) => {
    const parsed = memberFields.safeParse(req.body);
    if (!parsed.success) { validation(res); return; }
    try {
      const result = await db.transaction(async tx => {
        const row = (await tx.insert(members).values(parsed.data).returning())[0];
        await tx.insert(memberChanges).values({ memberId: row.id, actorId: getOfficer(res).id, action: 'CREATED', changes: parsed.data });
        return row;
      });
      res.status(201).json({ member: result });
    } catch (error) {
      if (isUniqueViolation(error)) { conflict(res); return; }
      throw error;
    }
  }));

  app.patch(base + '/:id', guards.csrf, asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id), parsed = updateFields.safeParse(req.body);
    if (!id.success || !parsed.success) { validation(res); return; }
    const { version, ...updates } = parsed.data;
    try {
      const updated = await db.transaction(async tx => {
        const existing = (await tx.select().from(members).where(eq(members.id, id.data)).limit(1))[0];
        if (!existing) return { missing: true as const };
        if (existing.version !== version) return { conflict: true as const };
        const previousName = existing.characterName;
        const changed = (await tx.update(members).set({
          ...updates, updatedAt: new Date(), version: sql`${members.version} + 1`
        }).where(and(eq(members.id, id.data), eq(members.version, version))).returning())[0];
        if (!changed) return { conflict: true as const };
        if (updates.characterName && updates.characterName !== previousName) {
          await tx.insert(memberAliases).values({ memberId: id.data, alias: previousName })
            .onConflictDoNothing();
        }
        await tx.insert(memberChanges).values({
          memberId: id.data, actorId: getOfficer(res).id, action: 'UPDATED',
          changes: Object.fromEntries(Object.entries(updates).map(([key, value]) =>
            [key, { from: (existing as unknown as Record<string, unknown>)[key], to: value }]))
        });
        return { member: changed };
      });
      if ('missing' in updated) { res.status(404).json({ error: 'Member not found' }); return; }
      if ('conflict' in updated) { conflict(res); return; }
      res.json(updated);
    } catch (error) {
      if (isUniqueViolation(error)) { conflict(res); return; }
      throw error;
    }
  }));

  app.post(base + '/:id/weekly-gr', guards.csrf, asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id), parsed = grBody.safeParse(req.body);
    if (!id.success || !parsed.success) { validation(res); return; }
    const exists = await db.select({ id: members.id }).from(members).where(eq(members.id, id.data)).limit(1);
    if (!exists.length) { res.status(404).json({ error: 'Member not found' }); return; }
    const item = parsed.data;
    try {
      const rows = await db.insert(weeklyGearRatings).values({
        memberId: id.data, weekStart: item.weekStart, gearRating: item.gearRating,
        sourceReference: item.sourceReference, capturedAt: item.capturedAt ? new Date(item.capturedAt) : null,
        reviewedAt: item.verified ? new Date() : null,
        reviewedBy: item.verified ? getOfficer(res).id : null
      }).returning();
      res.status(201).json({ snapshot: rows[0] });
    } catch (error) {
      if (isUniqueViolation(error)) { conflict(res); return; }
      throw error;
    }
  }));

  app.post(base + '/:id/weekly-gr/:snapshotId/correct', guards.csrf, asyncHandler(async (req, res) => {
    const id = uuid.safeParse(req.params.id), snap = uuid.safeParse(req.params.snapshotId);
    const parsed = correctionBody.safeParse(req.body);
    if (!id.success || !snap.success || !parsed.success) { validation(res); return; }
    const { version, reason, ...updates } = parsed.data;
    const outcome = await db.transaction(async tx => {
      const previous = (await tx.select().from(weeklyGearRatings)
        .where(and(eq(weeklyGearRatings.id, snap.data), eq(weeklyGearRatings.memberId, id.data))).limit(1))[0];
      if (!previous) return { missing: true as const };
      if (previous.version !== version) return { conflict: true as const };
      const changed = (await tx.update(weeklyGearRatings).set({
        gearRating: updates.gearRating, sourceReference: updates.sourceReference,
        reviewedAt: updates.verified ? new Date() : null,
        reviewedBy: updates.verified ? getOfficer(res).id : null,
        capturedAt: updates.capturedAt ? new Date(updates.capturedAt) : null,
        updatedAt: new Date(), version: sql`${weeklyGearRatings.version} + 1`
      }).where(and(eq(weeklyGearRatings.id, snap.data), eq(weeklyGearRatings.version, version)))
        .returning())[0];
      if (!changed) return { conflict: true as const };
      await tx.insert(weeklyGrCorrections).values({
        snapshotId: snap.data, changedBy: getOfficer(res).id,
        previousValue: previous.gearRating, updatedValue: updates.gearRating,
        previousSource: previous.sourceReference, updatedSource: updates.sourceReference, reason
      });
      return { snapshot: changed };
    });
    if ('missing' in outcome) { res.status(404).json({ error: 'Snapshot not found' }); return; }
    if ('conflict' in outcome) { conflict(res); return; }
    res.json(outcome);
  }));

  // One-time import: no fuzzy/automatic matching and no accidental overwriting.
  // Only the roster fields are imported. Gear, attendance and screenshot evidence remain in browser.
  app.post('/api/management/roster-import', guards.authenticate, guards.ready, guards.csrf,
    noStore, asyncHandler(async (req, res) => {
      const parsed = importBatch.safeParse(req.body);
      if (!parsed.success) { validation(res); return; }
      const batch = parsed.data.members;
      const names = batch.map(m => m.characterName.toLocaleLowerCase());
      const ids = batch.map(m => m.legacyId);
      if (new Set(names).size !== names.length || new Set(ids).size !== ids.length) {
        res.status(409).json({ error: 'Duplicate member name or legacy ID in preview; resolve manually' }); return;
      }
      try {
        const result = await db.transaction(async tx => {
          await tx.execute(sql`select pg_advisory_xact_lock(832175, 9102)`);
          const count = (await tx.select({ count: sql<number>`count(*)::int` }).from(members))[0]?.count ?? 0;
          if (count !== 0) return null;
          const inserted = await tx.insert(members).values(batch).returning({ id: members.id, legacyId: members.legacyId });
          await tx.insert(memberChanges).values(inserted.map(m => ({
            memberId: m.id, actorId: getOfficer(res).id, action: 'LEGACY_IMPORT',
            changes: { legacyId: m.legacyId, source: 'localStorage roster-only reviewed import' }
          })));
          return inserted;
        });
        if (!result) { res.status(409).json({ error: 'Server roster is not empty; review mapping instead of merging automatically' }); return; }
        res.status(201).json({ imported: result.length, mapping: result });
      } catch (error) {
        if (isUniqueViolation(error)) { conflict(res); return; }
        throw error;
      }
    }));
}
