-- Music module: catalogue, access, memberships, unlocks, play quotas.
-- Apply once to shared DB; schema mirrored in gallery + CRM repos.

CREATE TYPE "MusicPublishStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "MusicAccessMode" AS ENUM ('FREE', 'PAID', 'MEMBERS_ONLY');
CREATE TYPE "MusicReleaseType" AS ENUM ('SINGLE', 'EP', 'ALBUM', 'LIVE_SESSION', 'ACOUSTIC_SESSION');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ReleaseUnlockSource" AS ENUM ('ORDER', 'CRM_MANUAL');

ALTER TYPE "OrderItemType" ADD VALUE IF NOT EXISTS 'RELEASE';
ALTER TYPE "OrderItemType" ADD VALUE IF NOT EXISTS 'MEMBERSHIP_PASS';

CREATE TABLE "music_releases" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverImage" TEXT,
    "artistName" TEXT NOT NULL DEFAULT 'Jojjy Gallery',
    "releaseType" "MusicReleaseType" NOT NULL DEFAULT 'SINGLE',
    "genre" TEXT,
    "publishStatus" "MusicPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "releaseDate" TIMESTAMP(3),
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_releases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_releases_slug_key" ON "music_releases"("slug");

CREATE TABLE "music_tracks" (
    "id" SERIAL NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "duration" INTEGER,
    "storageKey" TEXT NOT NULL,
    "bitrate" INTEGER,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_tracks_releaseId_trackNumber_key" ON "music_tracks"("releaseId", "trackNumber");

CREATE TABLE "music_access_policies" (
    "id" SERIAL NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "accessMode" "MusicAccessMode" NOT NULL DEFAULT 'PAID',
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "paidPlayLimit" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_access_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_access_policies_releaseId_key" ON "music_access_policies"("releaseId");

CREATE TABLE "music_membership_plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "durationDays" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_membership_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "music_memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipPlanId" INTEGER NOT NULL,
    "orderId" TEXT,
    "grantedByCrmUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_memberships_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "music_memberships_userId_status_idx" ON "music_memberships"("userId", "status");

CREATE TABLE "music_release_unlocks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "orderItemId" TEXT,
    "grantedByCrmUserId" TEXT,
    "source" "ReleaseUnlockSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "music_release_unlocks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_release_unlocks_userId_releaseId_key" ON "music_release_unlocks"("userId", "releaseId");

CREATE TABLE "music_paid_play_quotas" (
    "id" TEXT NOT NULL,
    "releaseId" INTEGER NOT NULL,
    "userId" TEXT,
    "anonymousKey" TEXT,
    "playCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "music_paid_play_quotas_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "music_paid_play_quotas_releaseId_userId_key" ON "music_paid_play_quotas"("releaseId", "userId");
CREATE UNIQUE INDEX "music_paid_play_quotas_releaseId_anonymousKey_key" ON "music_paid_play_quotas"("releaseId", "anonymousKey");

ALTER TABLE "music_tracks" ADD CONSTRAINT "music_tracks_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "music_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "music_access_policies" ADD CONSTRAINT "music_access_policies_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "music_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "music_memberships" ADD CONSTRAINT "music_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "music_memberships" ADD CONSTRAINT "music_memberships_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "music_membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "music_release_unlocks" ADD CONSTRAINT "music_release_unlocks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "music_release_unlocks" ADD CONSTRAINT "music_release_unlocks_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "music_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "music_paid_play_quotas" ADD CONSTRAINT "music_paid_play_quotas_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "music_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "music_paid_play_quotas" ADD CONSTRAINT "music_paid_play_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "releaseId" INTEGER;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "membershipPlanId" INTEGER;

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "music_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_membershipPlanId_fkey" FOREIGN KEY ("membershipPlanId") REFERENCES "music_membership_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
