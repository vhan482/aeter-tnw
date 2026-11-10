CREATE TABLE "member_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"alias" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" varchar(32) NOT NULL,
	"changes" jsonb NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_gr_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"changed_by" uuid,
	"previous_value" integer,
	"updated_value" integer,
	"previous_source" varchar(255),
	"updated_source" varchar(255),
	"reason" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "combat_role" varchar(40);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "legacy_id" varchar(80);--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD COLUMN "source_reference" varchar(255);--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "member_aliases" ADD CONSTRAINT "member_aliases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_changes" ADD CONSTRAINT "member_changes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_changes" ADD CONSTRAINT "member_changes_actor_id_officer_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_gr_corrections" ADD CONSTRAINT "weekly_gr_corrections_snapshot_id_weekly_gear_ratings_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."weekly_gear_ratings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_gr_corrections" ADD CONSTRAINT "weekly_gr_corrections_changed_by_officer_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "member_alias_unique_idx" ON "member_aliases" USING btree ("member_id","alias");--> statement-breakpoint
CREATE INDEX "member_changes_member_idx" ON "member_changes" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "weekly_gr_corrections_snapshot_idx" ON "weekly_gr_corrections" USING btree ("snapshot_id");--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD CONSTRAINT "weekly_gear_ratings_reviewed_by_officer_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_character_name_ci_uidx" ON "members" USING btree (lower("character_name"));--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_legacy_id_unique" UNIQUE("legacy_id");