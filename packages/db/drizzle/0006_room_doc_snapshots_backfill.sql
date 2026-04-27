CREATE TABLE IF NOT EXISTS "room_doc_snapshots" (
	"room_id" uuid PRIMARY KEY NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.room_doc_snapshots') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'room_doc_snapshots_room_id_rooms_id_fk'
         AND conrelid = 'public.room_doc_snapshots'::regclass
     ) THEN
    ALTER TABLE "room_doc_snapshots"
      ADD CONSTRAINT "room_doc_snapshots_room_id_rooms_id_fk"
      FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END;
$$;
