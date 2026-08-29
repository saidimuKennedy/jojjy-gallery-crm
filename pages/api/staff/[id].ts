import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/require-permission";

async function countActiveStaffWriters(excludeUserId?: string): Promise<number> {
  const perm = await prisma.crmPermission.findUnique({
    where: { key: "staff:write" },
  });
  if (!perm) return 0;

  const users = await prisma.crmUser.findMany({
    where: {
      isActive: true,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      OR: [
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: { permissionId: perm.id },
                },
              },
            },
          },
        },
        {
          permissions: {
            some: { permissionId: perm.id, granted: true },
          },
        },
      ],
    },
    select: { id: true },
  });

  return users.length;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ success: false, message: "Invalid staff id" });
  }

  if (req.method === "PATCH") {
    const auth = await requirePermission(req, res, "staff:write");
    if (!auth) return;

    try {
      const existing = await prisma.crmUser.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Staff user not found" });
      }

      const { name, password, isActive, roleId } = req.body as {
        name?: string;
        password?: string;
        isActive?: boolean;
        roleId?: string | null;
      };

      if (isActive === false) {
        const remaining = await countActiveStaffWriters(id);
        const targetCanWrite =
          existing.roles.some((r) => r.role.name === "Admin") ||
          (await prisma.crmUserPermission.findFirst({
            where: {
              userId: id,
              granted: true,
              permission: { key: "staff:write" },
            },
          }));
        if (targetCanWrite && remaining === 0) {
          return res.status(409).json({
            success: false,
            message: "Cannot deactivate the last staff administrator",
          });
        }
      }

      if (roleId) {
        const role = await prisma.crmRole.findUnique({ where: { id: roleId } });
        if (!role) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid roleId" });
        }
      }

      const data: {
        name?: string | null;
        isActive?: boolean;
        passwordHash?: string;
      } = {};

      if (name !== undefined) data.name = name.trim() || null;
      if (typeof isActive === "boolean") data.isActive = isActive;
      if (password) {
        if (password.length < 8) {
          return res.status(400).json({
            success: false,
            message: "Password must be at least 8 characters",
          });
        }
        data.passwordHash = await hashPassword(password);
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.crmUser.update({ where: { id }, data });
        }

        if (roleId !== undefined) {
          await tx.crmUserRole.deleteMany({ where: { userId: id } });
          if (roleId) {
            await tx.crmUserRole.create({
              data: { userId: id, roleId },
            });
          }
        }
      });

      const updated = await prisma.crmUser.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });

      return res.status(200).json({
        success: true,
        data: updated
          ? {
              id: updated.id,
              email: updated.email,
              name: updated.name,
              isActive: updated.isActive,
              createdAt: updated.createdAt.toISOString(),
              roles: updated.roles.map((r) => ({
                id: r.role.id,
                name: r.role.name,
              })),
            }
          : null,
      });
    } catch (error) {
      console.error("Error updating staff user:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  res.setHeader("Allow", ["PATCH"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
