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
  { key: "events:publish", description: "Publish, schedule, cancel, or complete events" },
  { key: "tickets:read", description: "View tickets and ticket types" },
  { key: "tickets:write", description: "Manage ticket types and archive tiers" },
  { key: "tickets:issue-complimentary", description: "Issue complimentary tickets" },
  { key: "tickets:check-in", description: "Scan or look up tickets at the door" },
  { key: "tickets:check-in-correct", description: "Reverse or correct a check-in" },
  { key: "orders:read", description: "View orders and fulfilment" },
  { key: "orders:write", description: "Mark orders fulfilled" },
  { key: "orders:refund-request", description: "Request a refund on a paid order" },
  { key: "orders:refund-approve", description: "Approve and submit refunds (cannot approve own request)" },
  { key: "reporting:read", description: "View event/order reports" },
  { key: "reporting:export", description: "Export attendee and report CSV" },
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

/**
 * Default non-admin roles. Staff runs daily ops but cannot grant access,
 * approve refunds, or export PII — those stay with Admin.
 */
const DEFAULT_ROLES: { name: string; description: string; keys: string[] }[] = [
  {
    name: "Staff",
    description: "Daily operations. Cannot manage staff, approve refunds, or export reports.",
    keys: DEFAULT_PERMISSIONS.map((p) => p.key).filter(
      (k) => k !== "staff:write" && k !== "orders:refund-approve" && k !== "reporting:export"
    ),
  },
  {
    name: "Box Office",
    description: "Ticket desk and door: events, complimentary tickets, check-in.",
    keys: [
      "events:read",
      "tickets:read",
      "tickets:issue-complimentary",
      "tickets:check-in",
      "tickets:check-in-correct",
      "orders:read",
    ],
  },
  {
    name: "Shop",
    description: "Merch desk: products, order fulfilment, refund requests.",
    keys: [
      "merch:read",
      "merch:write",
      "orders:read",
      "orders:write",
      "orders:refund-request",
    ],
  },
  {
    name: "Comms",
    description: "Announcements and read-only catalogue access.",
    keys: [
      "announcements:read",
      "announcements:write",
      "artworks:read",
      "series:read",
      "events:read",
      "music:read",
    ],
  },
];

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required");
  }

  let connectionString = rawUrl;
  let isLocalHost = false;
  try {
    const url = new URL(rawUrl);
    isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!isLocalHost) {
      url.searchParams.set("sslmode", "no-verify");
    }
    connectionString = url.toString();
  } catch {
    /* keep as-is */
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: isLocalHost ? false : { rejectUnauthorized: false },
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

    // Default operational roles. Created once by name; re-seeds only refresh
    // the description so staff customizations to role permissions survive.
    const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));
    for (const preset of DEFAULT_ROLES) {
      const existing = await prisma.crmRole.findUnique({
        where: { name: preset.name },
      });
      if (existing) {
        await prisma.crmRole.update({
          where: { id: existing.id },
          data: { description: preset.description },
        });
        continue;
      }
      await prisma.crmRole.create({
        data: {
          name: preset.name,
          description: preset.description,
          permissions: {
            create: preset.keys
              .map((key) => permByKey.get(key))
              .filter((id): id is string => typeof id === "string")
              .map((permissionId) => ({ permissionId })),
          },
        },
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
