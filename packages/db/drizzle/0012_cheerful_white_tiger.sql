CREATE TYPE "public"."static_analysis_source" AS ENUM('run', 'submission');--> statement-breakpoint
CREATE TYPE "public"."static_analysis_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "static_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"session_id" uuid,
	"run_id" uuid,
	"submission_id" uuid,
	"language" "supported_language" NOT NULL,
	"source" "static_analysis_source" NOT NULL,
	"status" "static_analysis_status" DEFAULT 'pending' NOT NULL,
	"diagnostic_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"max_cyclomatic_complexity" integer,
	"high_complexity_count" integer DEFAULT 0 NOT NULL,
	"duplication_count" integer DEFAULT 0 NOT NULL,
	"tool_failure_count" integer DEFAULT 0 NOT NULL,
	"report" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "static_analysis_results_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "static_analysis_results" ADD CONSTRAINT "static_analysis_results_exactly_one_target_check" CHECK ((("run_id" IS NOT NULL)::integer + ("submission_id" IS NOT NULL)::integer) = 1);--> statement-breakpoint
CREATE INDEX "static_analysis_results_user_id_idx" ON "static_analysis_results" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "static_analysis_results_room_created_idx" ON "static_analysis_results" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "static_analysis_results_session_id_idx" ON "static_analysis_results" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "static_analysis_results_run_id_idx" ON "static_analysis_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "static_analysis_results_submission_id_idx" ON "static_analysis_results" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "static_analysis_results_status_idx" ON "static_analysis_results" USING btree ("status");
