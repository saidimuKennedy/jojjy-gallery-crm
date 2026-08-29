-- Track the actual amount/currency charged at Paystack when it differs from
-- the catalogue amount/currency (catalogue is USD; Paystack test account
-- only settles in KES), so payment verification can validate correctly
-- while the order's own amount/currency stay in the catalogue currency.
ALTER TABLE "orders" ADD COLUMN "paystackChargeAmount" DECIMAL(12,2);
ALTER TABLE "orders" ADD COLUMN "paystackChargeCurrency" TEXT;
