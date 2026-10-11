import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/require-permission";

function serializeRole(role: {
  id: string;
  name: string;
  description: string | null;
  permissions: Array<{ permission: { key: string } }>;
  _count: { users: number };
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
    userCount: role._count.users,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "staff:read"))) return;
    try {
      const [roles, permissions] = await Promise.all([
        prisma.crmRole.findMany({
          orderBy: { name: "asc" },
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { users: true } },
          },
        }),
        prisma.crmPermission.findMany({ orderBy: { key: "asc" } }),
      ]);
      return res.status(200).json({
        success: true,
        data: {
          roles: roles.map(serializeRole),
          permissions: permissions.map((p) => ({
            id: p.id,
            key: p.key,
            description: p.description,
          })),
        },
      });
    } catch (error) {
      console.error("Error listing roles:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    if (!(await requirePermission(req, res, "staff:write"))) return;
    try {
      const { name, description, permissionKeys } = req.body as {
        name?: string;
        description?: string | null;
        permissionKeys?: unknown;
      };
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) {
        return res
          .status(400)
          .json({ success: false, message: "Role name is required" });
      }
      const keys = Array.isArray(permissionKeys)
        ? [...new Set(permissionKeys.filter((k): k is string => typeof k === "string"))]
        : [];
      const catalog = await prisma.crmPermission.findMany({
        where: { key: { in: keys } },
        select: { id: true, key: true },
      });
      if (catalog.length !== keys.length) {
        return res.status(400).json({
          success: false,
          message: "One or more permission keys are unknown",
        });
      }
      const role = await prisma.crmRole.create({
        data: {
          name: trimmed,
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
          permissions: {
            create: catalog.map((p) => ({ permissionId: p.id })),
          },
        },
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      });
      return res.status(201).json({ success: true, data: serializeRole(role) });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        return res.status(409).json({
          success: false,
          message: "A role with that name already exists",
        });
      }
      console.error("Error creating role:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
