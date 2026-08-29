import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hashPassword } from "../lib/auth";

/**
 * Optional bootstrap: creates permission catalog, Admin role, and one staff user.
 *
 * Usage:
 *   CRM_SEED_EMAIL=you@example.com CRM_SEED_PASSWORD=changeme npm run prisma:seed
 *
 * Do not run against production without reviewing.
 */

const DEFAULT_PERMISSIONS = [
  { key: "artworks:read", description: "View artworks" },
  { key: "artworks:write", description: "Create/update artworks" },
  { key: "series:read", description: "View series" },
  { key: "series:write", description: "Create/update series" },
  { key: "events:read", description: "View events" },
  { key: "events:write", description: "Create/update events" },
  { key: "tickets:read", description: "View tickets" },
  { key: "tickets:write", description: "Manage ticket types and check-in" },
  { key: "merch:read", description: "View merch" },
  { key: "merch:write", description: "Manage products and inventory" },
  { key: "announcements:read", description: "View announcements" },
  { key: "announcements:write", description: "Create and send announcements" },
  { key: "staff:read", description: "View staff and permissions" },
  { key: "staff:write", description: "Manage staff, roles, and permissions" },
  { key: "music:read", description: "View music releases and plans" },
  { key: "music:write", description: "Create/update music and grant access" },
  { key: "music:publish", description: "Publish or schedule music releases" },
  { key: "music:archive", description: "Archive music releases" },
];

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let connectionString = rawUrl;
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("sslmode", "no-verify");
    connectionString = url.toString();
  } catch {
    /* keep as-is */
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const p of DEFAULT_PERMISSIONS) {
      await prisma.crmPermission.upsert({
        where: { key: p.key },
        create: p,
        update: { description: p.description },
      });
    }

    const allPerms = await prisma.crmPermission.findMany();

    const adminRole = await prisma.crmRole.upsert({
      where: { name: "Admin" },
      create: {
        name: "Admin",
        description: "Full CRM access",
        permissions: {
          create: allPerms.map((p) => ({ permissionId: p.id })),
        },
      },
      update: { description: "Full CRM access" },
      include: { permissions: true },
    });

    // Ensure Admin has every permission (idempotent re-seed)
    for (const p of allPerms) {
      await prisma.crmRolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: adminRole.id,
            permissionId: p.id,
          },
        },
        create: { roleId: adminRole.id, permissionId: p.id },
        update: {},
      });
    }

    const email = process.env.CRM_SEED_EMAIL?.toLowerCase().trim();
    const password = process.env.CRM_SEED_PASSWORD;

    if (email && password) {
      const passwordHash = await hashPassword(password);
      const user = await prisma.crmUser.upsert({
        where: { email },
        create: {
          email,
          name: process.env.CRM_SEED_NAME || "Admin",
          passwordHash,
          roles: { create: [{ roleId: adminRole.id }] },
        },
        update: { passwordHash, isActive: true },
      });

      await prisma.crmUserRole.upsert({
        where: {
          userId_roleId: { userId: user.id, roleId: adminRole.id },
        },
        create: { userId: user.id, roleId: adminRole.id },
        update: {},
      });

      console.log(`Seeded Admin role + user ${email}`);
    } else {
      console.log(
        "Seeded permissions + Admin role. Set CRM_SEED_EMAIL and CRM_SEED_PASSWORD to create a user."
      );
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
