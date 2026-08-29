import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import {
  Image,
  Layers,
  Calendar,
  Ticket,
  ShoppingBag,
  Megaphone,
  Users,
  LayoutDashboard,
  LogOut,
  FileText,
  Music,
  Mail,
} from "lucide-react";
import { ReactNode, useMemo } from "react";

const NAV = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true as const,
  },
  { href: "/dashboard/artworks", label: "Artworks", icon: Image, permission: "artworks:read" },
  { href: "/dashboard/series", label: "Series", icon: Layers, permission: "series:read" },
  {
    href: "/dashboard/media-blog",
    label: "Media & Blog",
    icon: FileText,
    permission: "artworks:read",
  },
  { href: "/dashboard/events", label: "Events", icon: Calendar, permission: "events:read" },
  { href: "/dashboard/tickets", label: "Tickets", icon: Ticket, permission: "tickets:read" },
  { href: "/dashboard/merch", label: "Merch", icon: ShoppingBag, permission: "merch:read" },
  { href: "/dashboard/music", label: "Music", icon: Music, permission: "music:read" },
  {
    href: "/dashboard/announcements",
    label: "Announcements",
    icon: Megaphone,
    permission: "announcements:read",
  },
  {
    href: "/dashboard/audience",
    label: "Audience",
    icon: Mail,
    permission: "announcements:read",
  },
  { href: "/dashboard/staff", label: "Staff", icon: Users, permission: "staff:read" },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const visibleNav = useMemo(
    () =>
      NAV.filter((item) => {
        if (!("permission" in item)) return true;
        return permissions.includes(item.permission);
      }),
    [permissions]
  );

  return (
    <div className="min-h-screen flex bg-ink-50 text-ink-950">
      <aside className="w-56 shrink-0 border-r border-ink-200 bg-white flex flex-col">
        <div className="px-5 py-6 border-b border-ink-200">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ink-500">
            Jojjy Gallery
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">CRM</h1>
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {visibleNav.map(({ href, label, icon: Icon, ...rest }) => {
            const exact = "exact" in rest && rest.exact;
            const active = exact
              ? router.pathname === href
              : router.pathname === href ||
                router.pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-ink-950 text-white"
                    : "text-ink-700 hover:bg-ink-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-ink-200 px-4 py-4">
          <p className="truncate text-xs text-ink-500">
            {session?.user?.email}
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-2 flex items-center gap-2 text-sm text-ink-700 hover:text-ink-950"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="mx-auto max-w-7xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
