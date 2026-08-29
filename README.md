# Jojjy Gallery CRM

Staff-facing admin app for [jojjy-gallery-app](../jojjy-gallery-app). Manages artworks, series, events, tickets, merch, announcements, and staff permissions. Deployed separately from the public gallery site.

## Shared database

This app and the public gallery share the **same Postgres database**.

- Each repo keeps its **own copy** of `prisma/schema.prisma` and its own generated Prisma Client.
- Both point at the same `DATABASE_URL` / `DIRECT_URL`.
- Schema stays in sync by convention: any migration that changes a shared table must be applied once to the DB and **mirrored in both repos’ schema files**.
- **Never** run `prisma migrate` from the gallery against a live DB without also adding the matching migration/SQL (and schema updates) here — and vice versa. Prefer hand-written SQL under `prisma/migrations/` and apply deliberately.

Staff identity is **not** the gallery `User` table. CRM uses `CrmUser`, `CrmSession`, `CrmRole`, `CrmPermission`, and join tables (`crm_*`).

## Setup

```bash
cp .env.example .env
# fill DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL

npm install
npx prisma generate
```

Apply migrations in this order on a shared DB:

1. From **jojjy-gallery-app**: the three `202607120*` migrations (`prisma migrate deploy` only when approved — never `migrate dev` against live).
2. From **this repo**: `20260712120000_add_crm_staff_auth` (CRM staff tables only).

```bash
# Example — review SQL first, then apply with your preferred tooling:
# prisma/migrations/20260712120000_add_crm_staff_auth/migration.sql
```

Optional seed (permissions catalog, Admin role, optional user):

```bash
CRM_SEED_EMAIL=you@example.com CRM_SEED_PASSWORD='changeme' npm run prisma:seed
```

## Run

```bash
npm run dev
# default Next port 3000 — set -p 3001 if the gallery already uses 3000
```

Sign in at `/login`. Dashboard routes under `/dashboard/*` require a session.

## Env vars

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres URL for the app (Prisma Client + `pg` adapter) |
| `DIRECT_URL` | Direct (non-pooled) URL for Prisma CLI / migrations (`prisma.config.js`) |
| `NEXTAUTH_SECRET` | NextAuth signing secret |
| `NEXTAUTH_URL` | Public origin of this CRM app (e.g. `http://localhost:3001`) |

## Stack

- Next.js 15 Pages Router + TypeScript + Tailwind
- Prisma 7 (`@prisma/adapter-pg`)
- NextAuth credentials against `CrmUser.passwordHash` (bcrypt)
- Permission model: composable `module:action` strings; roles are presets; per-user grants/revokes override roles

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | `prisma generate` + `next build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` | Generate client |
| `npm run prisma:seed` | Seed permissions / Admin / optional user |
