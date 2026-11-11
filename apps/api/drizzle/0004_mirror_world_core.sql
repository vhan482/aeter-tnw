CREATE TABLE "mirror_world_bosses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "race" varchar(50),
  "size" varchar(50),
  "element" varchar(50),
  "element_level" integer,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_world_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "boss_id" uuid NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "duration_seconds" integer DEFAULT 900 NOT NULL,
  "rotation" varchar(80),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_world_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "member_id" uuid NOT NULL,
  "rank" integer,
  "damage_raw" varchar(32) NOT NULL,
  "damage_estimate" numeric(24, 0) NOT NULL,
  "approximate" boolean NOT NULL,
  "source_reference" varchar(255) NOT NULL,
  "evidence_upload_id" uuid,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mirror_world_result_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "result_id" uuid NOT NULL,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirror_world_bosses" ADD CONSTRAINT "mirror_world_bosses_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_sessions" ADD CONSTRAINT "mirror_world_sessions_boss_id_mirror_world_bosses_id_fk" FOREIGN KEY ("boss_id") REFERENCES "public"."mirror_world_bosses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_sessions" ADD CONSTRAINT "mirror_world_sessions_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_results" ADD CONSTRAINT "mirror_world_results_session_id_mirror_world_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mirror_world_sessions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_results" ADD CONSTRAINT "mirror_world_results_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_results" ADD CONSTRAINT "mirror_world_results_evidence_upload_id_attendance_evidence_id_fk" FOREIGN KEY ("evidence_upload_id") REFERENCES "public"."attendance_evidence"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_results" ADD CONSTRAINT "mirror_world_results_reviewed_by_officer_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_result_history" ADD CONSTRAINT "mirror_world_result_history_result_id_mirror_world_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."mirror_world_results"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_result_history" ADD CONSTRAINT "mirror_world_result_history_changed_by_officer_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "mirror_world_boss_name_uidx" ON "mirror_world_bosses" USING btree (lower("name"));
--> statement-breakpoint
CREATE INDEX "mirror_world_session_date_idx" ON "mirror_world_sessions" USING btree ("starts_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "mirror_world_result_member_uidx" ON "mirror_world_results" USING btree ("session_id","member_id");
--> statement-breakpoint
CREATE INDEX "mirror_world_result_session_idx" ON "mirror_world_results" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "mirror_world_result_history_idx" ON "mirror_world_result_history" USING btree ("result_id");
