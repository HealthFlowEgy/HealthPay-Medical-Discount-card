ALTER TYPE "request_status" ADD VALUE 'completed';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"national_id_hash" text NOT NULL,
	"national_id_encrypted" text NOT NULL,
	"national_id_last4" varchar(4) NOT NULL,
	"mobile_encrypted" text NOT NULL,
	"mobile_e164" varchar(20) NOT NULL,
	"whatsapp" boolean DEFAULT true NOT NULL,
	"id_card_url" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_requests" ALTER COLUMN "partner_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "client_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "requested_services" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clients_national_id_hash_idx" ON "clients" USING btree ("national_id_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_mobile_idx" ON "clients" USING btree ("mobile_e164");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "service_requests_client_idx" ON "service_requests" USING btree ("client_id");