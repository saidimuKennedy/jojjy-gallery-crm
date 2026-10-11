/**
 * Single operational-status definition for orders shared by the Overview
 * command centre (recent-orders list). Labels are type-aware:
 * - Physical (deliveryMethod set): Awaiting fulfilment / Fulfilled
 * - Tickets: Tickets issued (checked-in state lives on Ticket rows)
 * - Releases: Access granted · Membership passes: Active
 * - Complimentary orders never imply payment occurred.
 * Non-paid orders fall back to the payment-status label.
 */

export type OperationalTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface OrderStatusInput {
  status: string;
  paymentStatus: string;
  source: string;
  fulfilledAt: string | null;
  deliveryMethod: string | null;
  /** Unique OrderItem.itemType values on the order. */
  itemTypes: string[];
}

function pretty(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function orderOperationalStatus(o: OrderStatusInput): {
  label: string;
  tone: OperationalTone;
} {
  if (o.source === "CRM_COMPLIMENTARY")
    return { label: "Complimentary", tone: "neutral" };
  if (o.status === "CANCELLED") return { label: "Cancelled", tone: "neutral" };
  if (o.status === "REFUNDED" || o.paymentStatus === "REFUNDED")
    return { label: "Refunded", tone: "neutral" };
  if (o.status === "FAILED" || o.paymentStatus === "FAILED")
    return { label: "Failed", tone: "danger" };
  if (o.paymentStatus === "NEEDS_ATTENTION")
    return { label: "Needs attention", tone: "danger" };
  if (o.paymentStatus === "REFUND_PENDING" || o.paymentStatus === "PARTIALLY_REFUNDED")
    return { label: pretty(o.paymentStatus), tone: "warning" };

  if (o.status === "PAID") {
    if (o.itemTypes.includes("TICKET"))
      return { label: "Tickets issued", tone: "success" };
    if (o.itemTypes.includes("RELEASE"))
      return { label: "Access granted", tone: "success" };
    if (o.itemTypes.includes("MEMBERSHIP_PASS"))
      return { label: "Active", tone: "success" };
    if (o.deliveryMethod)
      return o.fulfilledAt
        ? { label: "Fulfilled", tone: "success" }
        : { label: "Awaiting fulfilment", tone: "warning" };
    return { label: "Paid", tone: "success" };
  }

  return { label: pretty(o.paymentStatus || o.status), tone: "warning" };
}
