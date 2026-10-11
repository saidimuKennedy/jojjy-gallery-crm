import type { NextApiRequest, NextApiResponse } from "next";
import { requirePermission } from "@/lib/require-permission";
import {
  ComplimentaryError,
  issueComplimentary,
} from "@/lib/ticketing/complimentary";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  const auth = await requirePermission(req, res, "tickets:issue-complimentary");
  if (!auth) return;

  const { id } = req.query;
  const eventId = typeof id === "string" ? parseInt(id, 10) : NaN;
  if (isNaN(eventId)) {
    return res.status(400).json({ success: false, message: "Invalid event id" });
  }

  const { ticketTypeId, reason, attendees } = req.body as {
    ticketTypeId?: number;
    reason?: string;
    attendees?: { name?: string; email?: string }[];
  };

  if (typeof ticketTypeId !== "number") {
    return res
      .status(400)
      .json({ success: false, message: "ticketTypeId is required" });
  }

  try {
    const { order, tickets } = await issueComplimentary({
      eventId,
      ticketTypeId,
      reason: reason ?? "",
      issuedByCrmUserId: auth.userId,
      attendees: attendees ?? [],
    });

    return res.status(201).json({
      success: true,
      message: "Complimentary tickets issued.",
      data: {
        orderId: order.id,
        eventId,
        ticketTypeId,
        quantity: tickets.length,
        tickets: tickets.map((t) => ({
          id: t.id,
          code: t.code,
          holderName: t.holderName,
          holderEmail: t.holderEmail,
        })),
      },
    });
  } catch (error) {
    if (error instanceof ComplimentaryError) {
      return res.status(error.httpStatus).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Error issuing complimentary tickets:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
