-- Databases that already ran the old 0003 backfill still hold the migration
-- time plus 90 days on those keys. Move them to created_at plus 90 days.
-- Keys that were extended since then have a different expiry and stay put.
UPDATE "api_tokens"
SET "expires_at" = "created_at" + interval '90 days'
WHERE "expires_at" = to_timestamp(1793613756810 / 1000.0) + interval '90 days';
