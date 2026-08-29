import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

/**
 * Newer `pg` treats sslmode=require as verify-full, which fails against
 * managed Postgres cert chains (Prisma Postgres, Neon, Supabase, etc.).
 */
function withRelaxedSsl(connectionString: string | undefined) {
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    url.searchParams.set("sslmode", "no-verify");
    return url.toString();
  } catch {
    const cleaned = connectionString
      .replace(/([?&])sslmode=[^&]*/gi, "$1")
      .replace(/[?&]$/, "");
    const sep = cleaned.includes("?") ? "&" : "?";
    return `${cleaned}${sep}sslmode=no-verify`;
  }
}

const connectionString = withRelaxedSsl(process.env.DATABASE_URL);

function createPrismaClient() {
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

let prisma: PrismaClient;

if (process.env.NODE_ENV === "production") {
  prisma = createPrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = createPrismaClient();
  }
  prisma = global.prisma;
}

export default prisma;
