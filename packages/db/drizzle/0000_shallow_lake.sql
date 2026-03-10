CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."room_status" AS ENUM('waiting', 'warmup', 'coding', 'wrapup', 'finished');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');