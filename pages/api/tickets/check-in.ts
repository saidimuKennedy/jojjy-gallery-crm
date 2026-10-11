import type { NextApiRequest, NextApiResponse } from "next";
import { requirePermission } from "@/lib/require-permission";
import { CheckInError, checkInTicket } from "@/lib/ticketing/checkin";

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

  const auth = await requirePermission(req, res, "tickets:check-in");
  if (!auth) return;

  const { code, eventId } = req.body as {
    code?: string;
    eventId?: number;
  };
  if (typeof eventId !== "number" || isNaN(eventId)) {
    return res
      .status(400)
      .json({ success: false, message: "eventId is required" });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res
      .status(400)
      .json({ success: false, message: "A ticket code is required" });
  }

  try {
    const ticket = await checkInTicket({
      code,
      eventId,
      crmUserId: auth.userId,
    });
    return res.status(200).json({
      success: true,
      data: {
        ticketId: ticket?.id,
        code: ticket?.code,
        status: ticket?.status,
        checkedInAt: ticket?.checkedInAt?.toISOString() ?? null,
        holderName: ticket?.holderName,
        holderEmail: ticket?.holderEmail,
        ticketType: ticket?.ticketType?.name,
        event: ticket?.ticketType?.event?.title,
        source: ticket?.source,
      },
    });
  } catch (error) {
    if (error instanceof CheckInError) {
      return res.status(error.httpStatus).json({
        success: false,
        code: error.code,
        message: error.message,
      });
    }
    console.error("Error checking in ticket:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}
