import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/require-permission";

function serializeStaffUser(user: {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  roles: Array<{ role: { id: string; name: string } }>;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    roles: user.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    if (!(await requirePermission(req, res, "staff:read"))) return;
    try {
      const users = await prisma.crmUser.findMany({
        orderBy: { createdAt: "desc" },
        include: { roles: { include: { role: true } } },
      });
      return res.status(200).json({
        success: true,
        data: users.map(serializeStaffUser),
      });
    } catch (error) {
      console.error("Error listing staff:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  }

  if (req.method === "POST") {
    const auth = await requirePermission(req, res, "staff:write");
    if (!auth) return;

    try {
      const { email, name, password, roleId } = req.body as {
        email?: string;
        name?: string;
        password?: string;
        roleId?: string;
      };

      if (!email || !password || typeof password !== "string") {
        return res.status(400).json({
          success: false,
          message: "email and password are required",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await prisma.crmUser.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "A staff user with this email already exists",
        });
      }

      if (roleId) {
        const role = await prisma.crmRole.findUnique({ where: { id: roleId } });
        if (!role) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid roleId" });
        }
      }

      const passwordHash = await hashPassword(password);
      const user = await prisma.crmUser.create({
        data: {
          email: normalizedEmail,
          name: name?.trim() || null,
          passwordHash,
          roles: roleId
            ? { create: [{ roleId }] }
            : undefined,
        },
        include: { roles: { include: { role: true } } },
      });

      return res.status(201).json({
        success: true,
        data: serializeStaffUser(user),
      });
    } catch (error) {
      console.error("Error creating staff user:", error);
      return res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}
