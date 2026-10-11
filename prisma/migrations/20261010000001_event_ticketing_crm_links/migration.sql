-- Plan 15 — CRM-only ticketing operations: refunds, check-in audit, CRM audit
-- log, and the foreign keys from the shared columns added by the app's
-- 20261010000000_event_ticketing_end_to_end migration to `crm_users`.
--
-- Deploy order: `migrate-app` runs first (shared columns/tables), then
-- `migrate-crm` (this file) once `crm_users` exists from crm_staff_auth.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM (
    'REQUESTED', 'APPROVED', 'REJECTED', 'SUBMITTED', 'PROCESSING',
    'PROCESSED', 'FAILED', 'NEEDS_ATTENTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RefundEventType" AS ENUM (
    'REQUESTED', 'APPROVED', 'REJECTED', 'SUBMITTED',
    'PROVIDER_UPDATE', 'PROCESSED', 'FAILED', 'NEEDS_ATTENTION'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "CheckInAction" AS ENUM ('CHECK_IN', 'REVERSAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "refunds" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "ticketId" TEXT,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "requesterCrmUserId" TEXT NOT NULL,
  "approverCrmUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "paystackTransactionRef" TEXT,
  "paystackRefundId" TEXT,
  "providerStatus" TEXT,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_paystackRefundId_key"
  ON "refunds"("paystackRefundId");
CREATE INDEX IF NOT EXISTS "refunds_status_idx" ON "refunds"("status");
CREATE INDEX IF NOT EXISTS "refunds_orderId_idx" ON "refunds"("orderId");

DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requesterCrmUserId_fkey"
    FOREIGN KEY ("requesterCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_approverCrmUserId_fkey"
    FOREIGN KEY ("approverCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- RefundEvent — append-only history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "refund_events" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "type" "RefundEventType" NOT NULL,
  "status" "RefundStatus",
  "message" TEXT,
  "providerStatus" TEXT,
  "actorCrmUserId" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refund_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "refund_events_refundId_idx"
  ON "refund_events"("refundId");

DO $$ BEGIN
  ALTER TABLE "refund_events" ADD CONSTRAINT "refund_events_refundId_fkey"
    FOREIGN KEY ("refundId") REFERENCES "refunds"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "refund_events" ADD CONSTRAINT "refund_events_actorCrmUserId_fkey"
    FOREIGN KEY ("actorCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- TicketCheckIn — append-only check-in audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "ticket_check_ins" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "action" "CheckInAction" NOT NULL,
  "crmUserId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_check_ins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ticket_check_ins_ticketId_idx"
  ON "ticket_check_ins"("ticketId");

DO $$ BEGIN
  ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "tickets"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ticket_check_ins" ADD CONSTRAINT "ticket_check_ins_crmUserId_fkey"
    FOREIGN KEY ("crmUserId") REFERENCES "crm_users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- CrmAuditLog — append-only CRM audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "crm_audit_logs" (
  "id" TEXT NOT NULL,
  "actorCrmUserId" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "before" JSONB,
  "after" JSONB,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "crm_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "crm_audit_logs_targetType_targetId_idx"
  ON "crm_audit_logs"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "crm_audit_logs_action_idx"
  ON "crm_audit_logs"("action");

DO $$ BEGIN
  ALTER TABLE "crm_audit_logs" ADD CONSTRAINT "crm_audit_logs_actorCrmUserId_fkey"
    FOREIGN KEY ("actorCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- FK links from shared columns/tables to crm_users
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_issuedByCrmUserId_fkey"
    FOREIGN KEY ("issuedByCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checkedInByCrmUserId_fkey"
    FOREIGN KEY ("checkedInByCrmUserId") REFERENCES "crm_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
