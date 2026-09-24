DO $$ BEGIN
 CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"option_id" uuid,
	"amount" numeric(12, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'EGP' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" varchar(50),
	"provider_reference" text,
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_option_id_pricing_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."pricing_options"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_request_idx" ON "payments" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_reference_idx" ON "payments" USING btree ("provider_reference");