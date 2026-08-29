-- Plan 14: Remove legacy M-Pesa / Transaction model
--
-- The legacy artwork-cart M-Pesa flow is gone (sandbox STK push, no callback).
-- Drop the dead `transactions` table and collapse the `PaymentProvider` enum to
-- PAYSTACK only. Postgres cannot DROP a single enum value, so we recreate the
-- type. The legacy provider was never persisted to a finalized order.

DROP TABLE IF EXISTS "transactions" CASCADE;

UPDATE "orders" SET "paymentProvider" = 'PAYSTACK' WHERE "paymentProvider" = 'MPESA';

CREATE TYPE "PaymentProvider_new" AS ENUM ('PAYSTACK');

ALTER TABLE "orders"
  ALTER COLUMN "paymentProvider"
  TYPE "PaymentProvider_new"
  USING ("paymentProvider"::text::"PaymentProvider_new");

DROP TYPE "PaymentProvider";

ALTER TYPE "PaymentProvider_new" RENAME TO "PaymentProvider";
