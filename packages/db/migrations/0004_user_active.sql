ALTER TABLE "clients" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ops_users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;