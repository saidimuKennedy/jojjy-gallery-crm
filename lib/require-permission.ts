import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { getUserPermissionKeys } from "@/lib/permissions";

/**
 * Require a signed-in, still-active CRM user with the given permission key.
 * Permissions are resolved fresh from the DB (roles + per-user grants/revokes)
 * on every call, not trusted from the JWT, so newly granted/revoked permissions
 * and deactivated accounts take effect immediately.
 */
async function activeSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ userId: string; permissions: string[] } | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  const user = await prisma.crmUser.findUnique({
    where: { id: session.user.id },
    select: { isActive: true },
  });
  if (!user || !user.isActive) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  const permissions = await getUserPermissionKeys(session.user.id);
  return { userId: session.user.id, permissions: [...permissions] };
}

export async function requirePermission(
  req: NextApiRequest,
  res: NextApiResponse,
  permission: string
): Promise<{ userId: string; permissions: string[] } | null> {
  const auth = await activeSession(req, res);
  if (!auth) return null;
  if (!auth.permissions.includes(permission)) {
    res.status(403).json({
      success: false,
      message: `Forbidden: missing permission ${permission}`,
    });
    return null;
  }
  return auth;
}

/** Any of the listed permissions is enough. */
export async function requireAnyPermission(
  req: NextApiRequest,
  res: NextApiResponse,
  keys: string[]
): Promise<{ userId: string; permissions: string[] } | null> {
  const auth = await activeSession(req, res);
  if (!auth) return null;
  if (!keys.some((k) => auth.permissions.includes(k))) {
    res.status(403).json({
      success: false,
      message: `Forbidden: needs one of ${keys.join(", ")}`,
    });
    return null;
  }
  return auth;
}
