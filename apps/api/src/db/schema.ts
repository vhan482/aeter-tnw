import { boolean, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Initial roster slice only. Do not import screenshot/attendance/disciplinary data into these tables.
export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterName: varchar('character_name', { length: 128 }).notNull(),
  jobClass: varchar('job_class', { length: 80 }),
  guildRole: varchar('guild_role', { length: 80 }), // In-game rank, NOT management access
  combatRole: varchar('combat_role', { length: 40 }),
  legacyId: varchar('legacy_id', { length: 80 }).unique(),
  memberStatus: varchar('member_status', { length: 24 }).notNull().default('ACTIVE'),
  joinedOn: date('joined_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  version: integer('version').notNull().default(1)
}, table => [index('members_character_name_idx').on(table.characterName),
  uniqueIndex('members_character_name_ci_uidx').on(sql`lower(${table.characterName})`)]);

export const weeklyGearRatings = pgTable('weekly_gear_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  weekStart: date('week_start').notNull(),
  gearRating: integer('gear_rating'), // NULL = not verified; never infer GR from roster Rating
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  sourceReference: varchar('source_reference', { length: 255 }),
  reviewedBy: uuid('reviewed_by').references(() => officerAccounts.id, { onDelete: 'set null' }),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('weekly_gr_member_week_uidx').on(table.memberId, table.weekStart)]);

/** Management accounts are different from in-game roster members. No public MEMBER access. */
export const officerAccounts = pgTable('officer_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 24 }).notNull(), // GUILD_LEADER | OFFICER | CLERK
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const officerSessions = pgTable('officer_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  officerId: uuid('officer_id').notNull().references(() => officerAccounts.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('officer_sessions_account_idx').on(table.officerId),
  index('officer_sessions_expiration_idx').on(table.expiresAt)]);

export const officerAudit = pgTable('officer_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => officerAccounts.id, { onDelete: 'set null' }),
  targetId: uuid('target_id').references(() => officerAccounts.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 60 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('officer_audit_created_idx').on(table.createdAt)]);


/** Preserve previous character names for later OCR identity matching. */
export const memberAliases = pgTable('member_aliases', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'cascade' }),
  alias: varchar('alias', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [uniqueIndex('member_alias_unique_idx').on(table.memberId, table.alias)]);

/** Authenticated corrections are append-only; no silent weekly GR overwrites. */
export const weeklyGrCorrections = pgTable('weekly_gr_corrections', {
  id: uuid('id').primaryKey().defaultRandom(),
  snapshotId: uuid('snapshot_id').notNull().references(() => weeklyGearRatings.id, { onDelete: 'restrict' }),
  changedBy: uuid('changed_by').references(() => officerAccounts.id, { onDelete: 'set null' }),
  previousValue: integer('previous_value'),
  updatedValue: integer('updated_value'),
  previousSource: varchar('previous_source', { length: 255 }),
  updatedSource: varchar('updated_source', { length: 255 }),
  reason: text('reason').notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('weekly_gr_corrections_snapshot_idx').on(table.snapshotId)]);

export const memberChanges = pgTable('member_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id, { onDelete: 'restrict' }),
  actorId: uuid('actor_id').references(() => officerAccounts.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 32 }).notNull(),
  changes: jsonb('changes').$type<Record<string, unknown>>().notNull(),
  changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('member_changes_member_idx').on(table.memberId)]);
