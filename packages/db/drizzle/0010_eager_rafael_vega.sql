ALTER TABLE "weakness_sessions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "weakness_sessions" ADD COLUMN "trend" "weakness_trend";--> statement-breakpoint
ALTER TABLE "weakness_sessions" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "weakness_sessions" ADD COLUMN "reported_at" timestamp with time zone;