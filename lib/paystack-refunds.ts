/**
 * Server-only Paystack refund client for the CRM. The secret key is read from
 * the server environment and never sent to the browser. Missing credentials are
 * a hard error surfaced to the operator (deployment prerequisite), never
 * silently swallowed.
 */
const PAYSTACK_BASE = "https://api.paystack.co";

function secretKey(): string {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not configured on the CRM server; refunds cannot be submitted."
    );
  }
  return secret;
}

export function isPaystackConfigured(): boolean {
  return !!process.env.PAYSTACK_SECRET_KEY;
}

export interface PaystackRefund {
  id: number;
  status: string;
  amount: number;
  currency: string;
  transaction: string | { reference?: string; id?: number };
  customer_note?: string | null;
  merchant_note?: string | null;
}

/**
 * Initiate a refund against the original, server-verified Paystack transaction
 * reference. Omit `amount` for a full refund; pass a major-unit amount for a
 * partial refund.
 */
export async function initializeRefund(params: {
  transaction: string;
  amount?: number;
  merchantNote?: string;
}): Promise<PaystackRefund> {
  const body: Record<string, unknown> = { transaction: params.transaction };
  if (params.amount != null) body.amount = Math.round(params.amount * 100);
  if (params.merchantNote) body.merchant_note = params.merchantNote;

  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Failed to initiate Paystack refund");
  }
  return json.data as PaystackRefund;
}

export async function fetchRefund(
  refundId: string | number
): Promise<PaystackRefund> {
  const res = await fetch(
    `${PAYSTACK_BASE}/refund/${encodeURIComponent(String(refundId))}`,
    { headers: { Authorization: `Bearer ${secretKey()}` } }
  );
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || "Failed to fetch Paystack refund");
  }
  return json.data as PaystackRefund;
}

export type LocalRefundStatus =
  | "SUBMITTED"
  | "PROCESSING"
  | "PROCESSED"
  | "FAILED"
  | "NEEDS_ATTENTION";

/** Map Paystack's refund status onto CRM values; unknown → NEEDS_ATTENTION. */
export function mapRefundStatus(status: string): LocalRefundStatus {
  switch ((status || "").toLowerCase()) {
    case "pending":
      return "SUBMITTED";
    case "processing":
      return "PROCESSING";
    case "success":
    case "processed":
      return "PROCESSED";
    case "failed":
    case "rejected":
      return "FAILED";
    default:
      return "NEEDS_ATTENTION";
  }
}
