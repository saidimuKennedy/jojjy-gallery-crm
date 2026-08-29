-- Plan 11: Audience MVP — subscriber status + subscribe timestamps

CREATE TYPE "SubscriberStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED');

ALTER TABLE "subscribers"
  ADD COLUMN IF NOT EXISTS "status" "SubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "subscribedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unsubscribedAt" TIMESTAMP(3);

UPDATE "subscribers"
SET "subscribedAt" = "createdAt"
WHERE "subscribedAt" IS DISTINCT FROM "createdAt";

CREATE INDEX IF NOT EXISTS "subscribers_status_idx" ON "subscribers"("status");
CREATE INDEX IF NOT EXISTS "subscribers_email_idx" ON "subscribers"("email");
