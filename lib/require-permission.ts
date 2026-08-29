import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth-options";

/**
 * Require a signed-in CRM user with the given permission key.
 * Returns the session user id, or null after writing 401/403.
 */
export async function requirePermission(
  req: NextApiRequest,
  res: NextApiResponse,
  permission: string
): Promise<{ userId: string; permissions: string[] } | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  const permissions = session.user.permissions ?? [];
  if (!permissions.includes(permission)) {
    res.status(403).json({
      success: false,
      message: `Forbidden: missing permission ${permission}`,
    });
    return null;
  }
  return { userId: session.user.id, permissions };
}

/** Any of the listed permissions is enough. */
export async function requireAnyPermission(
  req: NextApiRequest,
  res: NextApiResponse,
  keys: string[]
): Promise<{ userId: string; permissions: string[] } | null> {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    res.status(401).json({ success: false, message: "Authentication required" });
    return null;
  }
  const permissions = session.user.permissions ?? [];
  if (!keys.some((k) => permissions.includes(k))) {
    res.status(403).json({
      success: false,
      message: `Forbidden: needs one of ${keys.join(", ")}`,
    });
    return null;
  }
  return { userId: session.user.id, permissions };
}
