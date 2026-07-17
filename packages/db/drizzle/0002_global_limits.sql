CREATE TABLE "global_limits" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "value" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

INSERT INTO "global_limits" ("key", "value")
VALUES
  ('ai_daily_limit', 100),
  ('execution_daily_limit', 100),
  ('rooms_max_active', 100);
