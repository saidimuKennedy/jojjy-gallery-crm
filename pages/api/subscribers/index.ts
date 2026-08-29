import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function serializeSubscriber(s: {
  id: string;
  email: string | null;
  status: string;
  subscribedAt: Date;
  unsubscribedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: s.id,
    email: s.email,
    status: s.status,
    subscribedAt: s.subscribedAt.toISOString(),
    unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  if (!(await requirePermission(req, res, "announcements:read"))) return;

  const q =
    typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const format =
    typeof req.query.format === "string" ? req.query.format.toLowerCase() : "";

  try {
    const where = q
      ? {
          AND: [
            { email: { not: null } },
            {
              email: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {
          email: { not: null },
        };

    const subscribers = await prisma.subscriber.findMany({
      where,
      orderBy: { subscribedAt: "desc" },
      select: {
        id: true,
        email: true,
        status: true,
        subscribedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    });

    const totalActive = await prisma.subscriber.count({
      where: {
        email: { not: null },
        status: "ACTIVE",
      },
    });

    if (format === "csv") {
      const header = "email,status,subscribedAt,unsubscribedAt";
      const rows = subscribers.map((s) => {
        const email = (s.email || "").replace(/"/g, '""');
        const subscribedAt = s.subscribedAt.toISOString();
        const unsubscribedAt = s.unsubscribedAt
          ? s.unsubscribedAt.toISOString()
          : "";
        return `"${email}",${s.status},${subscribedAt},${unsubscribedAt}`;
      });
      const csv = [header, ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="subscribers.csv"'
      );
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      success: true,
      data: {
        totalActive,
        subscribers: subscribers.map(serializeSubscriber),
      },
    });
  } catch (error) {
    console.error("Error listing subscribers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}
