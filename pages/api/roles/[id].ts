import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  const roleId = typeof id === "string" ? id : "";
  if (!roleId) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid role id" });
  }

  if (req.method === "PATCH") {
    if (!(await requirePermission(req, res, "staff:write"))) return;
    try {
      const { name, description, permissionKeys } = req.body as {
        name?: string;
        description?: string | null;
        permissionKeys?: unknown;
      };
      const data: { name?: string; description?: string | null } = {};
      if (name !== undefined) {
        const trimmed = typeof name === "string" ? name.trim() : "";
        if (!trimmed) {
          return res
            .status(400)
            .json({ success: false, message: "Role name is required" });
        }
        data.name = trimmed;
      }
      if (description !== undefined) {
        data.description =
          typeof description === "string" && description.trim()
            ? description.trim()
            : null;
      }

      const role = await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.crmRole.update({ where: { id: roleId }, data });
        }
        if (permissionKeys !== undefined) {
          const keys = Array.isArray(permissionKeys)
            ? [
                ...new Set(
                  permissionKeys.filter((k): k is string => typeof k === "string")
                ),
              ]
            : [];
          const catalog = await tx.crmPermission.findMany({
            where: { key: { in: keys } },
            select: { id: true },
          });
          if (catalog.length !== keys.length) {
            throw new Error("UNKNOWN_PERMISSION_KEYS");
          }
          await tx.crmRolePermission.deleteMany({ where: { roleId } });
          if (catalog.length > 0) {
            await tx.crmRolePermission.createMany({
              data: catalog.map((p) => ({ roleId, permissionId: p.id })),
            });
          }
        }
        return tx.crmRole.findUnique({
          where: { id: roleId },
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { users: true } },
          },
        });
      });

      if (!role) {
        return res
          .status(404)
          .json({ success: false, message: "Role not found" });
      }
      return res.status(200).json({
        success: true,
        data: {
          id: role.id,
          name: role.name,
          description: role.description,
          permissionKeys: role.permissions.map((rp) => rp.permission.key),
          userCount: role._count.users,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNKNOWN_PERMISSION_KEYS") {
        return res.status(400).json({
          success: false,
          message: "One or more permission keys are unknown",
        });
      }
      if ((error as { code?: string }).code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A role with that name already exists",
        });
      }
      if ((error as { code?: string }).code === "P2025") {
        return res
          .status(404)
          .json({ success: false, message: "Role not found" });
      }
      console.error("Error updating role:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "DELETE") {
    if (!(await requirePermission(req, res, "staff:write"))) return;
    try {
      const assigned = await prisma.crmUserRole.count({
        where: { roleId },
      });
      if (assigned > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This role is assigned to staff users. Reassign them first.",
        });
      }
      await prisma.crmRole.delete({ where: { id: roleId } });
      return res
        .status(200)
        .json({ success: true, message: "Role deleted", data: null });
    } catch (error) {
      if ((error as { code?: string }).code === "P2025") {
        return res
          .status(404)
          .json({ success: false, message: "Role not found" });
      }
      console.error("Error deleting role:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["PATCH", "DELETE"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
