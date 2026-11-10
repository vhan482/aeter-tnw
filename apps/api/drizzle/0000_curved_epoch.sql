CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_name" varchar(128) NOT NULL,
	"job_class" varchar(80),
	"guild_role" varchar(80),
	"member_status" varchar(24) DEFAULT 'ACTIVE' NOT NULL,
	"joined_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_gear_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"gear_rating" integer,
	"captured_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "weekly_gear_ratings" ADD CONSTRAINT "weekly_gear_ratings_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_character_name_idx" ON "members" USING btree ("character_name");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_gr_member_week_uidx" ON "weekly_gear_ratings" USING btree ("member_id","week_start");