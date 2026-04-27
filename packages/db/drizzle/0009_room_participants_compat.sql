ALTER TABLE "room_participants" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "room_participants" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "room_participants_active_heartbeat_idx" ON "room_participants" USING btree ("last_heartbeat_at") WHERE "room_participants"."is_active" = true;
