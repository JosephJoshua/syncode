CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."follow_up_type" AS ENUM('question', 'hint', 'evaluation', 'encouragement');--> statement-breakpoint
CREATE TYPE "public"."hint_level" AS ENUM('subtle', 'moderate', 'direct');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'matched', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."role_swap_status" AS ENUM('pending', 'accepted', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."room_mode" AS ENUM('ai', 'peer');--> statement-breakpoint
CREATE TYPE "public"."room_role" AS ENUM('host', 'interviewer', 'candidate', 'spectator');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'warmup', 'coding', 'wrapup', 'finished');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('ongoing', 'finished');--> statement-breakpoint
CREATE TYPE "public"."snapshot_trigger" AS ENUM('submission', 'phase_change', 'periodic', 'manual', 'session_end');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."supported_language" AS ENUM('python', 'javascript', 'typescript', 'java', 'cpp', 'c', 'go', 'rust');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."weakness_category" AS ENUM('edge_cases', 'time_complexity', 'space_complexity', 'variable_naming', 'code_structure', 'off_by_one', 'input_validation', 'communication');--> statement-breakpoint
CREATE TYPE "public"."weakness_trend" AS ENUM('improving', 'stable', 'worsening');--> statement-breakpoint
CREATE TABLE "ai_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"hint" text NOT NULL,
	"hint_level" "hint_level" NOT NULL,
	"related_concepts" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"session_id" uuid,
	"user_id" uuid,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"follow_up_type" "follow_up_type",
	"difficulty" "difficulty",
	"audio_key" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"categories" jsonb NOT NULL,
	"suggestions" jsonb NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" varchar(100) NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(255) NOT NULL,
	"metadata" jsonb,
	"ip_address" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"user_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_problem_id_pk" PRIMARY KEY("user_id","problem_id")
);
--> statement-breakpoint
CREATE TABLE "code_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"code" text NOT NULL,
	"language" "supported_language" NOT NULL,
	"trigger" "snapshot_trigger" NOT NULL,
	"lines_of_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"test_case_index" integer NOT NULL,
	"passed" boolean,
	"stdout" text,
	"stderr" text,
	"exit_code" integer,
	"expected" text,
	"actual" text,
	"duration_ms" integer,
	"memory_usage_mb" real,
	"timed_out" boolean DEFAULT false NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"response_body" jsonb,
	"status_code" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"difficulty" "difficulty",
	"language" "supported_language",
	"preferred_role" varchar(20),
	"preferred_tags" jsonb,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"matched_room_id" uuid,
	"matched_with_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peer_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"room_id" uuid NOT NULL,
	"reviewer_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"problem_solving_rating" integer NOT NULL,
	"communication_rating" integer NOT NULL,
	"code_quality_rating" integer NOT NULL,
	"debugging_rating" integer NOT NULL,
	"overall_rating" integer NOT NULL,
	"strengths" text NOT NULL,
	"improvements" text NOT NULL,
	"would_pair_again" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "problem_tags" (
	"problem_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "problem_tags_problem_id_tag_id_pk" PRIMARY KEY("problem_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "problems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"difficulty" "difficulty" NOT NULL,
	"company" varchar(100),
	"constraints" text,
	"examples" jsonb,
	"starter_code" jsonb,
	"time_limit" integer,
	"memory_limit" integer,
	"total_submissions" integer DEFAULT 0 NOT NULL,
	"accepted_submissions" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "recording_consents" (
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"consent" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recording_consents_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_swap_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"target_user_id" uuid NOT NULL,
	"status" "role_swap_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "room_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_id" uuid NOT NULL,
	"name" varchar(100),
	"problem_id" uuid,
	"language" "supported_language",
	"mode" "room_mode" NOT NULL,
	"status" "room_status" DEFAULT 'waiting' NOT NULL,
	"max_participants" integer DEFAULT 2 NOT NULL,
	"max_duration" integer DEFAULT 120 NOT NULL,
	"invite_code" varchar(6) NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"editor_locked" boolean DEFAULT false NOT NULL,
	"timer_paused" boolean DEFAULT false NOT NULL,
	"phase_started_at" timestamp with time zone,
	"elapsed_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"code" text NOT NULL,
	"language" "supported_language" NOT NULL,
	"stdin" text,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"stdout" text,
	"stderr" text,
	"exit_code" integer,
	"duration_ms" integer,
	"cpu_time_ms" integer,
	"memory_usage_mb" real,
	"timed_out" boolean DEFAULT false NOT NULL,
	"output_truncated" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_deletions" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_deletions_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"user_id" uuid,
	"metadata" jsonb,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_participants" (
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "room_role" NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "session_participants_session_id_user_id_pk" PRIMARY KEY("session_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"duration_ms" integer,
	"format" varchar(50),
	"size_bytes" bigint,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "session_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"category_scores" jsonb NOT NULL,
	"strengths" jsonb,
	"areas_for_improvement" jsonb,
	"feedback" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"problem_id" uuid,
	"mode" "room_mode" NOT NULL,
	"language" "supported_language",
	"status" "session_status" DEFAULT 'ongoing' NOT NULL,
	"duration_ms" integer,
	"whiteboard_export_key" varchar(500),
	"whiteboard_captured_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"problem_id" uuid NOT NULL,
	"code" text NOT NULL,
	"language" "supported_language" NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"total_test_cases" integer NOT NULL,
	"passed_test_cases" integer DEFAULT 0 NOT NULL,
	"failed_test_cases" integer DEFAULT 0 NOT NULL,
	"error_test_cases" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"problem_id" uuid NOT NULL,
	"input" text NOT NULL,
	"expected_output" text NOT NULL,
	"description" varchar(255),
	"is_hidden" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"timeout_ms" integer,
	"memory_mb" integer
);
--> statement-breakpoint
CREATE TABLE "user_weaknesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" "weakness_category" NOT NULL,
	"description" text NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"trend" "weakness_trend" DEFAULT 'stable' NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"display_name" varchar(100),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"bio" text,
	"avatar_url" text,
	"banned_at" timestamp with time zone,
	"banned_reason" text,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "weakness_sessions" (
	"weakness_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	CONSTRAINT "weakness_sessions_weakness_id_session_id_pk" PRIMARY KEY("weakness_id","session_id")
);
--> statement-breakpoint
ALTER TABLE "ai_hints" ADD CONSTRAINT "ai_hints_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_hints" ADD CONSTRAINT "ai_hints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reviews" ADD CONSTRAINT "ai_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_snapshots" ADD CONSTRAINT "code_snapshots_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_snapshots" ADD CONSTRAINT "code_snapshots_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution_results" ADD CONSTRAINT "execution_results_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_matched_room_id_rooms_id_fk" FOREIGN KEY ("matched_room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_requests" ADD CONSTRAINT "match_requests_matched_with_user_id_users_id_fk" FOREIGN KEY ("matched_with_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_candidate_id_users_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "problem_tags" ADD CONSTRAINT "problem_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_consents" ADD CONSTRAINT "recording_consents_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_consents" ADD CONSTRAINT "recording_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_swap_requests" ADD CONSTRAINT "role_swap_requests_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_swap_requests" ADD CONSTRAINT "role_swap_requests_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_swap_requests" ADD CONSTRAINT "role_swap_requests_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_participants" ADD CONSTRAINT "room_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_deletions" ADD CONSTRAINT "session_deletions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_deletions" ADD CONSTRAINT "session_deletions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_events" ADD CONSTRAINT "session_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_recordings" ADD CONSTRAINT "session_recordings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_cases" ADD CONSTRAINT "test_cases_problem_id_problems_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_weaknesses" ADD CONSTRAINT "user_weaknesses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_sessions" ADD CONSTRAINT "weakness_sessions_weakness_id_user_weaknesses_id_fk" FOREIGN KEY ("weakness_id") REFERENCES "public"."user_weaknesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weakness_sessions" ADD CONSTRAINT "weakness_sessions_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_hints_room_id_idx" ON "ai_hints" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "ai_hints_user_id_idx" ON "ai_hints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_messages_session_id_idx" ON "ai_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "ai_messages_room_created_idx" ON "ai_messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_reviews_room_id_idx" ON "ai_reviews" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "ai_reviews_user_id_idx" ON "ai_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_created_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "bookmarks_problem_id_idx" ON "bookmarks" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "code_snapshots_room_id_idx" ON "code_snapshots" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "code_snapshots_session_created_idx" ON "code_snapshots" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_results_submission_case_unique" ON "execution_results" USING btree ("submission_id","test_case_index");--> statement-breakpoint
CREATE INDEX "idempotency_keys_user_id_idx" ON "idempotency_keys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idempotency_keys_expires_at_idx" ON "idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "match_requests_user_id_idx" ON "match_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_requests_status_idx" ON "match_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "match_requests_expires_at_idx" ON "match_requests" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "peer_feedback_room_reviewer_candidate_unique" ON "peer_feedback" USING btree ("room_id","reviewer_id","candidate_id");--> statement-breakpoint
CREATE INDEX "peer_feedback_session_id_idx" ON "peer_feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "peer_feedback_reviewer_id_idx" ON "peer_feedback" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "peer_feedback_candidate_id_idx" ON "peer_feedback" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "problem_tags_tag_id_idx" ON "problem_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "problems_title_unique" ON "problems" USING btree ("title") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "problems_difficulty_idx" ON "problems" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "problems_title_trgm_idx" ON "problems" USING gin (title gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "problems_description_trgm_idx" ON "problems" USING gin (description gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "problems_created_at_idx" ON "problems" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "role_swap_requests_room_id_idx" ON "role_swap_requests" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "role_swap_requests_requester_id_idx" ON "role_swap_requests" USING btree ("requester_id");--> statement-breakpoint
CREATE INDEX "role_swap_requests_target_user_id_idx" ON "role_swap_requests" USING btree ("target_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_participants_room_user_unique" ON "room_participants" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "room_participants_user_id_idx" ON "room_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "room_participants_user_active_idx" ON "room_participants" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_invite_code_unique" ON "rooms" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "rooms_host_id_idx" ON "rooms" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "rooms_problem_id_idx" ON "rooms" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "rooms_status_idx" ON "rooms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "rooms_created_at_idx" ON "rooms" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "runs_user_id_idx" ON "runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "runs_room_created_idx" ON "runs" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "runs_job_id_idx" ON "runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "session_deletions_user_id_idx" ON "session_deletions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_events_session_timestamp_idx" ON "session_events" USING btree ("session_id","timestamp");--> statement-breakpoint
CREATE INDEX "session_events_event_type_idx" ON "session_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "session_participants_user_id_idx" ON "session_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_recordings_session_id_idx" ON "session_recordings" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_reports_session_id_unique" ON "session_reports" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_room_id_unique" ON "sessions" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "sessions_problem_id_idx" ON "sessions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "sessions_started_at_idx" ON "sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "submissions_user_id_idx" ON "submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "submissions_problem_id_idx" ON "submissions" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "submissions_room_submitted_idx" ON "submissions" USING btree ("room_id","submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_unique" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "test_cases_problem_sort_idx" ON "test_cases" USING btree ("problem_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "user_weaknesses_user_category_unique" ON "user_weaknesses" USING btree ("user_id","category");--> statement-breakpoint
CREATE INDEX "user_weaknesses_user_frequency_idx" ON "user_weaknesses" USING btree ("user_id","frequency");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "weakness_sessions_session_id_idx" ON "weakness_sessions" USING btree ("session_id");