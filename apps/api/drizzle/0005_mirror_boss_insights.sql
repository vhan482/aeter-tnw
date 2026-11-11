ALTER TABLE "mirror_world_bosses" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE "mirror_world_boss_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "boss_id" uuid NOT NULL,
  "before" jsonb NOT NULL,
  "after" jsonb NOT NULL,
  "reason" text NOT NULL,
  "changed_by" uuid,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mirror_world_boss_history" ADD CONSTRAINT "mirror_world_boss_history_boss_id_mirror_world_bosses_id_fk" FOREIGN KEY ("boss_id") REFERENCES "public"."mirror_world_bosses"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "mirror_world_boss_history" ADD CONSTRAINT "mirror_world_boss_history_changed_by_officer_accounts_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "mirror_world_boss_history_boss_idx" ON "mirror_world_boss_history" USING btree ("boss_id");
