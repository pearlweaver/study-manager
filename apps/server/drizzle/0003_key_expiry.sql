ALTER TABLE "api_tokens" ADD COLUMN "expires_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "api_tokens" SET "expires_at" = "created_at" + interval '90 days';
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" SET DEFAULT now() + interval '90 days';
--> statement-breakpoint
ALTER TABLE "api_tokens" ALTER COLUMN "expires_at" SET NOT NULL;
