import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Download, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ComingSoon";

type SubscriberRow = {
  id: string;
  email: string | null;
  status: string;
  subscribedAt: string;
  unsubscribedAt: string | null;
};

type AudiencePayload = {
  totalActive: number;
  subscribers: SubscriberRow[];
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as AudiencePayload;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AudiencePage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const swrKey = `/api/subscribers${
    debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""
  }`;

  const { data, error, isLoading } = useSWR<AudiencePayload>(swrKey, fetcher);

  const exportHref = `/api/subscribers?format=csv${
    debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ""
  }`;

  const countLabel = data
    ? `${data.totalActive.toLocaleString()} Subscriber${
        data.totalActive === 1 ? "" : "s"
      }`
    : "Subscribers";

  return (
    <DashboardLayout>
      <Head>
        <title>Audience — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Audience"
        description="Email subscribers who opted in for studio updates."
      >
        <a
          href={exportHref}
          className="inline-flex items-center gap-2 border border-ink-300 bg-white px-4 py-2 text-sm text-ink-900 hover:border-ink-950"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </PageHeader>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2 text-ink-900">
          <Users className="h-5 w-5 text-ink-500" />
          <p className="text-lg font-medium tracking-tight">{countLabel}</p>
        </div>
        <div className="w-full sm:max-w-xs">
          <label
            htmlFor="audience-search"
            className="block text-xs font-medium uppercase tracking-wide text-ink-500"
          >
            Search
          </label>
          <input
            id="audience-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email…"
            className="mt-1 w-full border border-ink-200 bg-white px-3 py-2 text-sm text-ink-950 outline-none focus:border-ink-950"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-ink-500">Loading subscribers…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error.message}</p>
      ) : !data?.subscribers.length ? (
        <p className="text-sm text-ink-500">
          {debouncedQ
            ? "No subscribers match that search."
            : "No email subscribers yet."}
        </p>
      ) : (
        <div className="overflow-x-auto border border-ink-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-200 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Subscribed</th>
              </tr>
            </thead>
            <tbody>
              {data.subscribers.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-ink-100 last:border-0"
                >
                  <td className="px-4 py-3 text-ink-900">
                    {row.email || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.status === "ACTIVE"
                          ? "text-ink-700"
                          : "text-ink-400"
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-ink-500">
                    {formatDate(row.subscribedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
