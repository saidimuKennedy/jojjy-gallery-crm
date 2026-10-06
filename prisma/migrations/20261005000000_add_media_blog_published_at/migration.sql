-- Editorial publication state for Studio/Journal entries: null = DRAFT (never
-- public), set = published. Backfill existing rows from createdAt so current
-- live content stays public.
ALTER TABLE "media_blog_entries" ADD COLUMN "publishedAt" TIMESTAMP(3);
UPDATE "media_blog_entries" SET "publishedAt" = "createdAt" WHERE "publishedAt" IS NULL;
