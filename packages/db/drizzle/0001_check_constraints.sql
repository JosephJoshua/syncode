-- Custom migration: CHECK constraints
-- These cannot be expressed inline in Drizzle v0.45 schema definitions

-- rooms: max_participants must be 2-8, max_duration must be positive
ALTER TABLE "rooms"
  ADD CONSTRAINT "chk_max_participants" CHECK (max_participants BETWEEN 2 AND 8),
  ADD CONSTRAINT "chk_max_duration" CHECK (max_duration > 0);
--> statement-breakpoint

-- peer_feedback: all ratings must be 1-5
ALTER TABLE "peer_feedback"
  ADD CONSTRAINT "chk_problem_solving" CHECK (problem_solving_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT "chk_communication" CHECK (communication_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT "chk_code_quality" CHECK (code_quality_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT "chk_debugging" CHECK (debugging_rating BETWEEN 1 AND 5),
  ADD CONSTRAINT "chk_overall" CHECK (overall_rating BETWEEN 1 AND 5);
--> statement-breakpoint

-- session_reports: overall_score must be 0-100
ALTER TABLE "session_reports"
  ADD CONSTRAINT "chk_overall_score" CHECK (overall_score BETWEEN 0 AND 100);
--> statement-breakpoint

-- ai_reviews: overall_score must be 0-100
ALTER TABLE "ai_reviews"
  ADD CONSTRAINT "chk_ai_review_score" CHECK (overall_score BETWEEN 0 AND 100);
