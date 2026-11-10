import { date, index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

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
