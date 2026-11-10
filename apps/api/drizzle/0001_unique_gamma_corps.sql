CREATE TABLE "officer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(32) NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" varchar(24) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "officer_accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "officer_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"target_id" uuid,
	"action" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "officer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"officer_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "officer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "officer_audit" ADD CONSTRAINT "officer_audit_actor_id_officer_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_audit" ADD CONSTRAINT "officer_audit_target_id_officer_accounts_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."officer_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "officer_sessions" ADD CONSTRAINT "officer_sessions_officer_id_officer_accounts_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officer_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "officer_audit_created_idx" ON "officer_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "officer_sessions_account_idx" ON "officer_sessions" USING btree ("officer_id");--> statement-breakpoint
CREATE INDEX "officer_sessions_expiration_idx" ON "officer_sessions" USING btree ("expires_at");