import prisma from "@/lib/prisma";

/**
 * Resolve effective permission keys for a CRM user.
 * Roles grant a base set; CrmUserPermission overrides:
 *   granted=true  → add
 *   granted=false → revoke even if role granted it
 */
export async function getUserPermissionKeys(
  userId: string
): Promise<Set<string>> {
  const user = await prisma.crmUser.findUnique({
    where: { id: userId },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: {
                include: { permission: true },
              },
            },
          },
        },
      },
      permissions: {
        include: { permission: true },
      },
    },
  });

  if (!user || !user.isActive) {
    return new Set();
  }

  const keys = new Set<string>();

  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      keys.add(rp.permission.key);
    }
  }

  for (const up of user.permissions) {
    if (up.granted) {
      keys.add(up.permission.key);
    } else {
      keys.delete(up.permission.key);
    }
  }

  return keys;
}

export async function userHasPermission(
  userId: string,
  key: string
): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId);
  return keys.has(key);
}
