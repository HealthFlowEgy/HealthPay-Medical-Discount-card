DO $$ BEGIN
 CREATE TYPE "public"."gender" AS ENUM('male', 'female');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."marital_status" AS ENUM('single', 'married', 'divorced', 'widowed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."provider_type" AS ENUM('labs', 'hospital', 'dental_clinics', 'physiotherapy_centers', 'doctors_clinics', 'radiology_centers', 'outpatient_clinic_centers', 'specialized_centers_outpatient');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."specialty" AS ENUM('labs', 'general_hospitals', 'dentistry', 'physiotherapy', 'radiology', 'outpatient_clinics', 'pediatrics', 'orthopedic_surgery', 'ophthalmology', 'cardiology', 'obstetrics_gynecology', 'ent', 'dermatology', 'internal_medicine', 'general_surgery', 'gastroenterology', 'neurosurgery', 'neurology', 'nephrology_urology', 'dental_maxillofacial_radiology', 'oncology', 'pulmonology', 'vascular_surgery', 'endocrinology', 'cardiothoracic_surgery', 'rheumatology_rehab');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"governorate" "governorate",
	"governorate_ar" text,
	"area" text,
	"address" text,
	"provider_type" "provider_type",
	"specialty" "specialty",
	"specialty_raw" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pricing_options" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "provider_type" "provider_type";--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "specialty" "specialty";--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "member_name_en" varchar(200);--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "member_name_ar" varchar(200);--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "company" varchar(200);--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "gender" "gender";--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "marital_status" "marital_status";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "providers_governorate_idx" ON "providers" USING btree ("governorate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "providers_area_idx" ON "providers" USING btree ("area");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "providers_provider_type_idx" ON "providers" USING btree ("provider_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "providers_specialty_idx" ON "providers" USING btree ("specialty");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pricing_options" ADD CONSTRAINT "pricing_options_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_provider_id_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
