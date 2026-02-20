CREATE TYPE "public"."processing_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');--> statement-breakpoint
CREATE TYPE "public"."sync_action" AS ENUM('no_change', 'updated_quantity', 'missing_mapping', 'skipped_not_active', 'error');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "alumni_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"graduation_year" integer NOT NULL,
	"invite_code" text NOT NULL,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "alumni_invites_email_unique" UNIQUE("email"),
	CONSTRAINT "alumni_invites_invite_code_unique" UNIQUE("invite_code"),
	CONSTRAINT "alumni_invites_graduation_year_range" CHECK ("alumni_invites"."graduation_year" BETWEEN 1900 AND 2100)
);
--> statement-breakpoint
CREATE TABLE "billing_customers" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"monthly_amount" integer DEFAULT 1 NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "billing_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"stripe_subscription_id" text,
	"stripe_event_id" text,
	"computed_years_out" integer NOT NULL,
	"expected_quantity" integer NOT NULL,
	"previous_quantity" integer,
	"action_taken" "sync_action" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_sync_log_years_out_min" CHECK ("billing_sync_log"."computed_years_out" >= 1),
	CONSTRAINT "billing_sync_log_expected_quantity_min" CHECK ("billing_sync_log"."expected_quantity" >= 1)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"stripe_event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_status" "processing_status" DEFAULT 'received' NOT NULL,
	"error_message" text,
	"related_customer_id" text,
	"related_subscription_id" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"graduation_year" integer NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_graduation_year_range" CHECK ("users"."graduation_year" BETWEEN 1900 AND 2100)
);
--> statement-breakpoint
ALTER TABLE "billing_customers" ADD CONSTRAINT "billing_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_log" ADD CONSTRAINT "billing_sync_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_sync_log" ADD CONSTRAINT "billing_sync_log_stripe_event_id_stripe_events_stripe_event_id_fk" FOREIGN KEY ("stripe_event_id") REFERENCES "public"."stripe_events"("stripe_event_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_alumni_invites_expires" ON "alumni_invites" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_alumni_invites_used" ON "alumni_invites" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "idx_billing_customers_stripe_customer_id" ON "billing_customers" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "idx_billing_subscriptions_status" ON "billing_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_billing_subscriptions_period_end" ON "billing_subscriptions" USING btree ("current_period_end");--> statement-breakpoint
CREATE INDEX "idx_billing_sync_log_user_created" ON "billing_sync_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_billing_sync_log_subscription_created" ON "billing_sync_log" USING btree ("stripe_subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_type_received" ON "stripe_events" USING btree ("event_type","received_at");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_related_customer" ON "stripe_events" USING btree ("related_customer_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_events_related_subscription" ON "stripe_events" USING btree ("related_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_users_graduation_year" ON "users" USING btree ("graduation_year");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");