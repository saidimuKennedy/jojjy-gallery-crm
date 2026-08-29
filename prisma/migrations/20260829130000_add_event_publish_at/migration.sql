-- Time-driven event publishing: optional publishAt schedules the DRAFT → PUBLISHED flip.
-- Leave publishAt null to publish manually via the CRM "Publish now" action.
ALTER TABLE "events" ADD COLUMN "publishAt" TIMESTAMP(3);
