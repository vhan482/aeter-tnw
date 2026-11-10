CREATE TABLE "attendance_assessment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"changed_by" uuid,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"assessment" varchar(32) NOT NULL,
	"rationale" text NOT NULL,
	"verification_method" varchar(24),
	"evidence_ref" varchar(255),
	"reviewed_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_checkpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"phase" varchar(12) NOT NULL,
	"captured_at" timestamp with time zone NOT NULL,
	"evidence_ref" varchar(255) NOT NULL,
	"evidence_upload_id" uuid,
	"coverage" varchar(12) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(24) NOT NULL,
	"title" varchar(160) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stored_name" varchar(64) NOT NULL,
	"original_name" varchar(160) NOT NULL,
	"mime_type" varchar(40) NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "attendance_evidence_stored_name_unique" UNIQUE("stored_name")
);
--> statement-breakpoint
CREATE TABLE "attendance_observation_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"observation_id" uuid NOT NULL,
	"before_status" varchar(12) NOT NULL,
	"after_status" varchar(12) NOT NULL,
	"reason" text NOT NULL,
	"corrected_by" uuid,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkpoint_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" varchar(12) NOT NULL,
	"reviewed_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_action_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"before" jsonb,
	"after" jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_action_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"event_id" uuid,
	"case_type" varchar(24) NOT NULL,
	"status" varchar(24) DEFAULT 'OPEN' NOT NULL,
	"assigned_officer_id" uuid,
	"follow_up_on" date,
	"officer_determination" text,
	"created_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_action_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"content" text NOT NULL,
	"source" varchar(160),
	"reported_at" timestamp with time zone,
	"author_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_assessment_history" ADD CONSTRAINT "attendance_assessment_history_assessment_id_attendance_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."attendance_assessments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_assessment_history" ADD CONSTRAINT "attendance_assessment_history_changed_by_officer_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_assessments" ADD CONSTRAINT "attendance_assessments_event_id_attendance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."attendance_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_assessments" ADD CONSTRAINT "attendance_assessments_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_assessments" ADD CONSTRAINT "attendance_assessments_reviewed_by_officer_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_checkpoints" ADD CONSTRAINT "attendance_checkpoints_event_id_attendance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."attendance_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_checkpoints" ADD CONSTRAINT "attendance_checkpoints_evidence_upload_id_attendance_evidence_id_fk" FOREIGN KEY ("evidence_upload_id") REFERENCES "public"."attendance_evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_checkpoints" ADD CONSTRAINT "attendance_checkpoints_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_events" ADD CONSTRAINT "attendance_events_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_evidence" ADD CONSTRAINT "attendance_evidence_uploaded_by_officer_accounts_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_observation_corrections" ADD CONSTRAINT "attendance_observation_corrections_observation_id_attendance_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."attendance_observations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_observation_corrections" ADD CONSTRAINT "attendance_observation_corrections_corrected_by_officer_accounts_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_observations" ADD CONSTRAINT "attendance_observations_checkpoint_id_attendance_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."attendance_checkpoints"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_observations" ADD CONSTRAINT "attendance_observations_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_observations" ADD CONSTRAINT "attendance_observations_reviewed_by_officer_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_audit" ADD CONSTRAINT "member_action_audit_case_id_member_action_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."member_action_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_audit" ADD CONSTRAINT "member_action_audit_actor_id_officer_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_cases" ADD CONSTRAINT "member_action_cases_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_cases" ADD CONSTRAINT "member_action_cases_event_id_attendance_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."attendance_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_cases" ADD CONSTRAINT "member_action_cases_assigned_officer_id_officer_accounts_id_fk" FOREIGN KEY ("assigned_officer_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_cases" ADD CONSTRAINT "member_action_cases_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_notes" ADD CONSTRAINT "member_action_notes_case_id_member_action_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."member_action_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_action_notes" ADD CONSTRAINT "member_action_notes_author_id_officer_accounts_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_assessment_history_idx" ON "attendance_assessment_history" USING btree ("assessment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_assessment_member_uidx" ON "attendance_assessments" USING btree ("event_id","member_id");--> statement-breakpoint
CREATE INDEX "attendance_checkpoints_event_idx" ON "attendance_checkpoints" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_checkpoint_evidence_uidx" ON "attendance_checkpoints" USING btree ("evidence_upload_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_checkpoint_source_uidx" ON "attendance_checkpoints" USING btree ("event_id","phase","captured_at","evidence_ref");--> statement-breakpoint
CREATE INDEX "attendance_events_starts_idx" ON "attendance_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "attendance_evidence_expires_idx" ON "attendance_evidence" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "attendance_evidence_deleted_idx" ON "attendance_evidence" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "attendance_observation_history_idx" ON "attendance_observation_corrections" USING btree ("observation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_observation_member_uidx" ON "attendance_observations" USING btree ("checkpoint_id","member_id");--> statement-breakpoint
CREATE INDEX "member_action_audit_case_idx" ON "member_action_audit" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "member_action_cases_status_idx" ON "member_action_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "member_action_cases_member_idx" ON "member_action_cases" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_action_notes_case_idx" ON "member_action_notes" USING btree ("case_id");