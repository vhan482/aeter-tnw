import { boolean, date, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

// Initial roster slice only. Do not import screenshot/attendance/disciplinary data into these tables.
export const members = pgTable('members', {
  id: uuid('id').primaryKey().defaultRandom(),
  characterName: varchar('character_name', { length: 128 }).notNull(),
  jobClass: varchar('job_class', { length: 80 }),
  guildRole: varchar('guild_role', { length: 80 }),
  memberStatus: varchar('member_status', { length: 24 }).notNull().default('ACTIVE'),
  joinedOn: date('joined_on'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [index('members_character_name_idx').on(table.characterName)]);

export const weeklyGearRatings = pgTable('weekly_gear_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  memberId: uuid('member_id').notNull().references(() => members.id),
  weekStart: date('week_start').notNull(),
  gearRating: integer('gear_rating'), // NULL = not verified; never infer GR from roster Rating
  capturedAt: timestamp('captured_at', { withTimezone: true }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
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
