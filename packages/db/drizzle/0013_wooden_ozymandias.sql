ALTER TABLE "peer_feedback" ALTER COLUMN "problem_solving_rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "communication_rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "code_quality_rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "debugging_rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "overall_rating" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "strengths" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "improvements" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ALTER COLUMN "would_pair_again" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD COLUMN "status" text DEFAULT 'submitted' NOT NULL;--> statement-breakpoint
ALTER TABLE "peer_feedback" ADD COLUMN "feedback_text" text;--> statement-breakpoint
UPDATE "peer_feedback"
SET
  "status" = 'submitted',
  "feedback_text" = COALESCE(
    "feedback_text",
    NULLIF(CONCAT_WS(E'\n\n', "strengths", "improvements"), '')
  );--> statement-breakpoint
