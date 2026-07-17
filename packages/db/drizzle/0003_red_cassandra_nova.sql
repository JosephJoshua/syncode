ALTER TABLE "match_requests" RENAME COLUMN "preferred_role" TO "requested_role";--> statement-breakpoint
ALTER TABLE "match_requests" RENAME COLUMN "preferred_tags" TO "requested_tags";--> statement-breakpoint
UPDATE "match_requests" SET "requested_role" = 'observer' WHERE "requested_role" = 'spectator';--> statement-breakpoint
UPDATE "match_requests" SET "requested_role" = 'candidate' WHERE "requested_role" = 'host';--> statement-breakpoint
ALTER TABLE "room_participants" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "session_participants" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "room_participants"
SET "role" = CASE
	WHEN "role" = 'spectator' THEN 'observer'
	WHEN "role" = 'host' THEN CASE
		WHEN EXISTS (
			SELECT 1
			FROM "rooms" r
			WHERE r."id" = "room_participants"."room_id"
			  AND r."host_id" = "room_participants"."user_id"
			  AND r."mode" = 'ai'
		) THEN 'candidate'
		ELSE 'interviewer'
	END
	ELSE "role"
END;--> statement-breakpoint
UPDATE "session_participants"
SET "role" = CASE
	WHEN "role" = 'spectator' THEN 'observer'
	WHEN "role" = 'host' THEN CASE
		WHEN EXISTS (
			SELECT 1
			FROM "sessions" s
			WHERE s."id" = "session_participants"."session_id"
			  AND s."mode" = 'ai'
		) THEN 'candidate'
		ELSE 'interviewer'
	END
	ELSE "role"
END;--> statement-breakpoint
ALTER TYPE "public"."room_role" RENAME TO "room_role_old";--> statement-breakpoint
CREATE TYPE "public"."room_role" AS ENUM('interviewer', 'candidate', 'observer');--> statement-breakpoint
ALTER TABLE "room_participants" ALTER COLUMN "role" SET DATA TYPE "public"."room_role" USING "role"::"public"."room_role";--> statement-breakpoint
ALTER TABLE "session_participants" ALTER COLUMN "role" SET DATA TYPE "public"."room_role" USING "role"::"public"."room_role";--> statement-breakpoint
DROP TYPE "public"."room_role_old";--> statement-breakpoint
