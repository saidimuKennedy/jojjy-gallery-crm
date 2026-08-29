import Head from "next/head";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { useSession } from "next-auth/react";

const MODULES = [
  {
    href: "/dashboard/artworks",
    label: "Artworks",
    blurb: "Catalogue, status, pricing, images",
  },
  {
    href: "/dashboard/series",
    label: "Series",
    blurb: "Exhibition copy and groupings",
  },
  {
    href: "/dashboard/media-blog",
    label: "Media & Blog",
    blurb: "Press and studio updates",
  },
  {
    href: "/dashboard/events",
    label: "Events",
    blurb: "Occasions, atmosphere, publish state",
  },
  {
    href: "/dashboard/tickets",
    label: "Tickets",
    blurb: "Ticket types and inventory",
  },
  {
    href: "/dashboard/merch",
    label: "Merch",
    blurb: "Products and stock",
  },
  {
    href: "/dashboard/music",
    label: "Music",
    blurb: "Releases, pass plans, grants",
  },
  {
    href: "/dashboard/announcements",
    label: "Announcements",
    blurb: "Audience messages",
  },
  {
    href: "/dashboard/audience",
    label: "Audience",
    blurb: "Email subscribers",
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    blurb: "Roles and permission keys",
  },
] as const;

export default function DashboardPage() {
  const { data: session } = useSession();

  return (
    <DashboardLayout>
      <Head>
        <title>Dashboard — Jojjy Gallery CRM</title>
      </Head>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <p className="mt-2 text-sm text-ink-600">
        Welcome{session?.user?.name ? `, ${session.user.name}` : ""}. Content
        management lives here — the public gallery site no longer hosts an
        admin panel.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {MODULES.map(({ href, label, blurb }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-ink-200 bg-white px-5 py-6 transition-colors hover:border-ink-400"
          >
            <p className="text-sm font-medium text-ink-900">{label}</p>
            <p className="mt-1 text-sm text-ink-500">{blurb}</p>
          </Link>
        ))}
      </div>

      {session?.user?.permissions?.length ? (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-ink-800">Your permissions</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {session.user.permissions.map((key) => (
              <li
                key={key}
                className="rounded border border-ink-200 bg-white px-2.5 py-1 font-mono text-xs text-ink-700"
              >
                {key}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-10 text-sm text-ink-500">
          No permissions assigned yet. An admin can grant roles or individual
          permissions from Staff.
        </p>
      )}
    </DashboardLayout>
  );
}
