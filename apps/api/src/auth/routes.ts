import { createHash, randomBytes } from 'node:crypto';
import type { Express, Request, Response, NextFunction } from 'express';
import { eq, and, gt, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { rateLimit } from 'express-rate-limit';
import type pg from 'pg';
import { z } from 'zod';
import { officerAccounts, officerSessions, officerAudit } from '../db/schema.js';
import type { ApiConfig } from '../config.js';
import { hashPassword, verifyPassword, PASSWORD_MIN } from './password.js';

type Role = 'GUILD_LEADER' | 'OFFICER' | 'CLERK';
type Officer = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
};
const COOKIE = 'aeter_session';
const SESSION_MS = 12 * 60 * 60 * 1000;
const USERNAME = z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_.-]{2,31}$/);
const PASSWORD = z.string().min(PASSWORD_MIN).max(128);
const credentials = z.object({ username: USERNAME, password: z.string().min(1).max(128) }).strict();
const createOfficer = z.object({
  username: USERNAME,
  displayName: z.string().trim().min(1).max(80),
  role: z.enum(['OFFICER', 'CLERK']),
  temporaryPassword: PASSWORD
}).strict();
const changePassword = z.object({ currentPassword: z.string().min(1), newPassword: PASSWORD }).strict();
const resetPassword = z.object({ temporaryPassword: PASSWORD }).strict();
const idParam = z.string().uuid();
const invalidCredentials = { error: 'Invalid credentials' };

function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
function readToken(req: Request): string | null {
  const raw = req.headers.cookie?.split(';').map(part => part.trim())
    .find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  return raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : null;
}
function cookieSettings(config: ApiConfig) {
  return {
    httpOnly: true, secure: config.NODE_ENV === 'production',
    sameSite: 'strict' as const, path: '/api', maxAge: SESSION_MS
  };
}
function publicOfficer(user: Officer) {
  return { id: user.id, username: user.username, displayName: user.displayName,
    role: user.role, mustChangePassword: user.mustChangePassword };
}
function handler(fn: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };
}
function officerFrom(res: Response) {
  return res.locals.officer as Officer;
}
function originGuard(origin: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers.origin !== origin) {
      res.status(403).json({ error: 'Request origin rejected' });
      return;
    }
    next();
  };
}

export function registerAuthRoutes(app: Express, pool: pg.Pool, config: ApiConfig) {
  const db = drizzle(pool);
  const csrf = originGuard(new URL(config.APP_ORIGIN).origin);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10,
    standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Too many attempts; try again later' }
  });
  // Uniform verification cost for unknown usernames, without exposing real account status.
  const dummyHash = hashPassword('nonexistent-account-dummy-password');

  async function issueSession(id: string, res: Response) {
    const token = randomBytes(32).toString('base64url');
    await db.insert(officerSessions).values({
      officerId: id, tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SESSION_MS)
    });
    res.cookie(COOKIE, token, cookieSettings(config));
  }

  const requireOfficer = handler(async (req, res) => {
    const token = readToken(req);
    if (!token) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    const records = await db.select({
      id: officerAccounts.id,
      username: officerAccounts.username,
      displayName: officerAccounts.displayName,
      role: officerAccounts.role,
      mustChangePassword: officerAccounts.mustChangePassword
    }).from(officerSessions).innerJoin(officerAccounts,
      eq(officerSessions.officerId, officerAccounts.id))
      .where(and(eq(officerSessions.tokenHash, hashToken(token)),
        gt(officerSessions.expiresAt, new Date()),
        eq(officerAccounts.active, true))).limit(1);
    const found = records[0];
    if (!found || !['GUILD_LEADER', 'OFFICER', 'CLERK'].includes(found.role)) {
      res.status(401).json({ error: 'Sign in required' });
      return;
    }
    res.locals.officer = found as Officer;
  });

  // Express 4 middleware must call next on success.
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    requireOfficer(req, res, (err?: unknown) => {
      if (err) { next(err); return; }
      if (res.headersSent) return;
      next();
    });
  };
  const ready = (_req: Request, res: Response, next: NextFunction) => {
    if (officerFrom(res).mustChangePassword) {
      res.status(403).json({ error: 'Change temporary password first' });
      return;
    }
    next();
  };
  const leaderOnly = (_req: Request, res: Response, next: NextFunction) => {
    if (officerFrom(res).role !== 'GUILD_LEADER') {
      res.status(403).json({ error: 'Guild Leader access required' });
      return;
    }
    next();
  };

  app.use('/api/auth', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.post('/api/auth/login', csrf, loginLimiter, handler(async (req, res) => {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid sign-in format' }); return; }
    const found = await db.select().from(officerAccounts)
      .where(eq(officerAccounts.username, parsed.data.username)).limit(1);
    const account = found[0];
    const ok = await verifyPassword(account?.passwordHash ?? await dummyHash, parsed.data.password);
    if (!account || !account.active || !ok) {
      res.status(401).json(invalidCredentials);
      return;
    }
    await issueSession(account.id, res);
    await db.insert(officerAudit).values({ actorId: account.id, targetId: account.id, action: 'LOGIN' });
    res.json({ officer: publicOfficer(account as Officer) });
  }));

  app.get('/api/auth/me', authenticate, (_req, res) =>
    res.json({ officer: publicOfficer(officerFrom(res)) }));

  app.post('/api/auth/logout', csrf, handler(async (req, res) => {
    const token = readToken(req);
    if (token) await db.delete(officerSessions).where(eq(officerSessions.tokenHash, hashToken(token)));
    res.clearCookie(COOKIE, { path: '/api', httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'strict' });
    res.status(204).end();
  }));

  app.post('/api/auth/change-password', csrf, authenticate, handler(async (req, res) => {
    const parsed = changePassword.safeParse(req.body);
    if (!parsed.success || parsed.data.currentPassword === parsed.data.newPassword) {
      res.status(400).json({ error: 'Invalid password change' });
      return;
    }
    const officer = officerFrom(res);
    const found = await db.select().from(officerAccounts).where(eq(officerAccounts.id, officer.id)).limit(1);
    if (!found[0] || !(await verifyPassword(found[0].passwordHash, parsed.data.currentPassword))) {
      res.status(401).json({ error: 'Current password incorrect' }); return;
    }
    const newHash = await hashPassword(parsed.data.newPassword);
    await db.transaction(async tx => {
      await tx.update(officerAccounts).set({ passwordHash: newHash,
        mustChangePassword: false, updatedAt: new Date() }).where(eq(officerAccounts.id, officer.id));
      await tx.delete(officerSessions).where(eq(officerSessions.officerId, officer.id));
      await tx.insert(officerAudit).values({ actorId: officer.id, targetId: officer.id, action: 'PASSWORD_CHANGED' });
    });
    await issueSession(officer.id, res);
    res.json({ officer: { ...publicOfficer(officer), mustChangePassword: false } });
  }));

  app.get('/api/officers', authenticate, ready, leaderOnly, handler(async (_req, res) => {
    const users = await db.select({
      id: officerAccounts.id, username: officerAccounts.username,
      displayName: officerAccounts.displayName, role: officerAccounts.role,
      active: officerAccounts.active, mustChangePassword: officerAccounts.mustChangePassword
    }).from(officerAccounts).orderBy(desc(officerAccounts.createdAt));
    res.json({ officers: users });
  }));

  app.post('/api/officers', csrf, authenticate, ready, leaderOnly, handler(async (req, res) => {
    const parsed = createOfficer.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid officer details' }); return; }
    const hash = await hashPassword(parsed.data.temporaryPassword);
    const created = await db.insert(officerAccounts).values({
      username: parsed.data.username, displayName: parsed.data.displayName,
      passwordHash: hash, role: parsed.data.role, mustChangePassword: true
    }).onConflictDoNothing({ target: officerAccounts.username })
      .returning({ id: officerAccounts.id });
    if (!created.length) { res.status(409).json({ error: 'Username already exists' }); return; }
    await db.insert(officerAudit).values({
      actorId: officerFrom(res).id, targetId: created[0].id, action: 'OFFICER_CREATED'
    });
    res.status(201).json({ id: created[0].id });
  }));

  app.post('/api/officers/:id/reset-password', csrf, authenticate, ready, leaderOnly, handler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    const parsed = resetPassword.safeParse(req.body);
    if (!id.success || !parsed.success) { res.status(400).json({ error: 'Invalid request' }); return; }
    const newHash = await hashPassword(parsed.data.temporaryPassword);
    const updated = await db.transaction(async tx => {
      const rows = await tx.update(officerAccounts).set({ passwordHash: newHash,
        mustChangePassword: true, updatedAt: new Date() })
        .where(and(eq(officerAccounts.id, id.data), eq(officerAccounts.active, true)))
        .returning({ id: officerAccounts.id });
      if (rows.length) {
        await tx.delete(officerSessions).where(eq(officerSessions.officerId, id.data));
        await tx.insert(officerAudit).values({ actorId: officerFrom(res).id,
          targetId: id.data, action: 'PASSWORD_RESET_BY_LEADER' });
      }
      return rows;
    });
    if (!updated.length) { res.status(404).json({ error: 'Officer not found' }); return; }
    res.status(204).end();
  }));

  app.post('/api/officers/:id/disable', csrf, authenticate, ready, leaderOnly, handler(async (req, res) => {
    const id = idParam.safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ error: 'Invalid officer ID' }); return; }
    const actor = officerFrom(res);
    if (id.data === actor.id) { res.status(409).json({ error: 'Cannot disable own account' }); return; }
    const updated = await db.transaction(async tx => {
      const rows = await tx.update(officerAccounts).set({ active: false, updatedAt: new Date() })
        .where(and(eq(officerAccounts.id, id.data),
          eq(officerAccounts.active, true))).returning({ id: officerAccounts.id });
      if (rows.length) {
        await tx.delete(officerSessions).where(eq(officerSessions.officerId, id.data));
        await tx.insert(officerAudit).values({ actorId: actor.id, targetId: id.data, action: 'OFFICER_DISABLED' });
      }
      return rows;
    });
    if (!updated.length) { res.status(404).json({ error: 'Officer not found' }); return; }
    res.status(204).end();
  }));

  // Central mount for future roster/attendance routes; they MUST authenticate first.
  app.use('/api/management', authenticate, ready, (_req, res) =>
    res.status(404).json({ error: 'Management endpoint not implemented' }));
}
