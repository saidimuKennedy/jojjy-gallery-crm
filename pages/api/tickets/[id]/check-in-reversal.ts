import type { NextApiRequest, NextApiResponse } from "next";
import { requirePermission } from "@/lib/require-permission";
import { CheckInError, reverseCheckIn } from "@/lib/ticketing/checkin";

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

  const auth = await requirePermission(req, res, "tickets:check-in-correct");
  if (!auth) return;

  const { id } = req.query;
  const ticketId = typeof id === "string" ? id : "";
  if (!ticketId) {
    return res.status(400).json({ success: false, message: "Invalid ticket id" });
  }

  const { reason } = req.body as { reason?: string };

  try {
    const ticket = await reverseCheckIn({
      ticketId,
      crmUserId: auth.userId,
      reason: reason ?? "",
    });
    return res.status(200).json({
      success: true,
      message: "Check-in reversed.",
      data: { ticketId: ticket?.id, status: ticket?.status },
    });
  } catch (error) {
    if (error instanceof CheckInError) {
      return res
        .status(error.httpStatus)
        .json({ success: false, message: error.message });
    }
    console.error("Error reversing check-in:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
