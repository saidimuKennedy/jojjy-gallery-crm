-- Fulfilment contact snapshot (operator copy taken at checkout) and physical
-- fulfilment state. Payment state remains in status; existing rows stay
-- UNFULFILLED (fulfilledAt null) by design.
ALTER TABLE "orders" ADD COLUMN "customerName" TEXT;
ALTER TABLE "orders" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "orders" ADD COLUMN "fulfilledAt" TIMESTAMP(3);
