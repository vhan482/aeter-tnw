CREATE TABLE "league_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "opponent_guild" varchar(128) NOT NULL,
  "occurred_at" timestamp with time zone NOT NULL,
  "stage" varchar(24),
  "result" varchar(24),
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_player_tab_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "match_id" uuid NOT NULL,
  "battlefield" varchar(8) NOT NULL,
  "tab" varchar(12) NOT NULL,
  "member_id" uuid NOT NULL,
  "metrics" jsonb NOT NULL,
  "source_reference" varchar(255) NOT NULL,
  "evidence_upload_id" uuid,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "league_player_tab_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tab_result_id" uuid NOT NULL,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "league_matches" ADD CONSTRAINT "league_matches_created_by_officer_accounts_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_results" ADD CONSTRAINT "league_player_tab_results_match_id_league_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."league_matches"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_results" ADD CONSTRAINT "league_player_tab_results_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_results" ADD CONSTRAINT "league_player_tab_results_evidence_upload_id_attendance_evidence_id_fk" FOREIGN KEY ("evidence_upload_id") REFERENCES "public"."attendance_evidence"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_results" ADD CONSTRAINT "league_player_tab_results_reviewed_by_officer_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_history" ADD CONSTRAINT "league_player_tab_history_tab_result_id_league_player_tab_results_id_fk" FOREIGN KEY ("tab_result_id") REFERENCES "public"."league_player_tab_results"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "league_player_tab_history" ADD CONSTRAINT "league_player_tab_history_changed_by_officer_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "league_matches_date_idx" ON "league_matches" USING btree ("occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "league_tabs_member_uidx" ON "league_player_tab_results" USING btree ("match_id","battlefield","tab","member_id");
--> statement-breakpoint
CREATE INDEX "league_tabs_match_idx" ON "league_player_tab_results" USING btree ("match_id");
--> statement-breakpoint
CREATE INDEX "league_tabs_history_result_idx" ON "league_player_tab_history" USING btree ("tab_result_id");
