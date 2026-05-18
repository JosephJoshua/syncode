CREATE TYPE "public"."session_report_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
DROP INDEX "session_reports_session_id_unique";--> statement-breakpoint
ALTER TABLE "session_reports" ALTER COLUMN "overall_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ALTER COLUMN "generated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "session_reports" ALTER COLUMN "generated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "status" "session_report_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "report" jsonb;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "model" varchar(120);--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "session_reports" ADD COLUMN "requested_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint

UPDATE "session_reports" AS sr
SET
  "status" = 'completed',
  "requested_at" = COALESCE(sr."generated_at", now()),
  "report" = jsonb_build_object(
    'sessionId', sr."session_id",
    'generatedAt', sr."generated_at",
    'overallScore', sr."overall_score",
    'strengths', COALESCE(sr."strengths", '[]'::jsonb),
    'areasForImprovement', COALESCE(sr."areas_for_improvement", '[]'::jsonb),
    'detailedFeedback', sr."feedback",
    'comparisonToHistory', NULL,
    'peerFeedbackSummary', NULL
  ),
  "user_id" = sp."user_id"
FROM (
  SELECT DISTINCT ON ("session_id") "session_id", "user_id"
  FROM "session_participants"
  ORDER BY "session_id", "joined_at", "user_id"
) AS sp
WHERE sr."session_id" = sp."session_id";--> statement-breakpoint

INSERT INTO "session_reports" (
  "id",
  "session_id",
  "user_id",
  "status",
  "overall_score",
  "report",
  "model",
  "error_message",
  "requested_at",
  "generated_at"
)
SELECT
  gen_random_uuid(),
  sr."session_id",
  sp."user_id",
  sr."status",
  sr."overall_score",
  sr."report",
  sr."model",
  sr."error_message",
  sr."requested_at",
  sr."generated_at"
FROM "session_reports" AS sr
INNER JOIN "session_participants" AS sp
  ON sp."session_id" = sr."session_id"
WHERE sr."user_id" IS NOT NULL
  AND sp."user_id" <> sr."user_id";--> statement-breakpoint

DELETE FROM "session_reports" WHERE "user_id" IS NULL;--> statement-breakpoint

ALTER TABLE "session_reports" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "session_reports_session_user_unique" ON "session_reports" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "session_reports_session_id_idx" ON "session_reports" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_reports_user_id_idx" ON "session_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_reports_status_idx" ON "session_reports" USING btree ("status");--> statement-breakpoint
ALTER TABLE "session_reports" DROP COLUMN "category_scores";--> statement-breakpoint
ALTER TABLE "session_reports" DROP COLUMN "strengths";--> statement-breakpoint
ALTER TABLE "session_reports" DROP COLUMN "areas_for_improvement";--> statement-breakpoint
ALTER TABLE "session_reports" DROP COLUMN "feedback";
