DO $$ BEGIN
 CREATE TYPE "public"."sms_status" AS ENUM('pending', 'sent', 'delivered', 'failed', 'undelivered', 'unknown');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid,
	"provider" varchar(40) NOT NULL,
	"recipient" varchar(20) NOT NULL,
	"client_message_id" varchar(64) NOT NULL,
	"provider_message_id" text,
	"status" "sms_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"raw_response" jsonb,
	"dlr" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_messages_request_idx" ON "sms_messages" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sms_messages_client_message_id_idx" ON "sms_messages" USING btree ("client_message_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sms_messages_provider_message_id_idx" ON "sms_messages" USING btree ("provider_message_id");