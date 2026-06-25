ALTER TYPE "ops_role" ADD VALUE 'super_admin';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "api_key_prefix" text;