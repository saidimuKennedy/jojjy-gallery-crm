import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";
import { stackMembershipExpiry } from "@/lib/music";

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

  const auth = await requirePermission(req, res, "music:write");
  if (!auth) return;

  const { type, userEmail, releaseId, membershipPlanId } = req.body as {
    type?: "unlock" | "membership" | "revoke_unlock" | "cancel_membership";
    userEmail?: string;
    releaseId?: number;
    membershipPlanId?: number;
  };

  if (!type || !userEmail) {
    return res.status(400).json({
      success: false,
      message: "type and userEmail are required",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: userEmail.trim().toLowerCase() },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Gallery user not found for that email",
      });
    }

    const crmUserId = auth.userId;

    if (type === "unlock") {
      const rid = Number(releaseId);
      if (!Number.isFinite(rid)) {
        return res
          .status(400)
          .json({ success: false, message: "releaseId required" });
      }
      const unlock = await prisma.releaseUnlock.upsert({
        where: {
          userId_releaseId: { userId: user.id, releaseId: rid },
        },
        create: {
          userId: user.id,
          releaseId: rid,
          source: "CRM_MANUAL",
          grantedByCrmUserId: crmUserId,
        },
        update: {
          source: "CRM_MANUAL",
          grantedByCrmUserId: crmUserId,
        },
      });
      return res.status(200).json({ success: true, data: unlock });
    }

    if (type === "revoke_unlock") {
      const rid = Number(releaseId);
      await prisma.releaseUnlock.deleteMany({
        where: { userId: user.id, releaseId: rid },
      });
      return res.status(200).json({ success: true });
    }

    if (type === "membership") {
      const planId = Number(membershipPlanId);
      const plan = await prisma.membershipPlan.findUnique({
        where: { id: planId },
      });
      if (!plan) {
        return res
          .status(404)
          .json({ success: false, message: "Plan not found" });
      }

      const existing = await prisma.membership.findFirst({
        where: { userId: user.id, status: "ACTIVE" },
        orderBy: { expiresAt: "desc" },
      });

      const expiresAt = stackMembershipExpiry(
        existing?.expiresAt ?? null,
        plan.durationDays
      );

      const membership = existing
        ? await prisma.membership.update({
            where: { id: existing.id },
            data: {
              membershipPlanId: plan.id,
              expiresAt,
              grantedByCrmUserId: crmUserId,
              status: "ACTIVE",
            },
          })
        : await prisma.membership.create({
            data: {
              userId: user.id,
              membershipPlanId: plan.id,
              grantedByCrmUserId: crmUserId,
              expiresAt,
              status: "ACTIVE",
            },
          });

      return res.status(200).json({
        success: true,
        data: {
          ...membership,
          expiresAt: membership.expiresAt.toISOString(),
        },
      });
    }

    if (type === "cancel_membership") {
      await prisma.membership.updateMany({
        where: { userId: user.id, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, message: "Unknown type" });
  } catch (error) {
    console.error("CRM music grant", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Grant failed",
    });
  }
}
