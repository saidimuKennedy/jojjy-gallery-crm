import { useEffect, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { Download, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  EmptyState,
  ErrorState,
  Field,
  LinkButton,
  LoadingState,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  TextField,
  Th,
} from "@/components/ui";

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
        subtitle="Email subscribers who opted in for studio updates."
        actions={
          <LinkButton href={exportHref} variant="secondary">
            <Download className="h-4 w-4" />
            Export CSV
          </LinkButton>
        }
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2 text-ink-900">
          <Users className="h-5 w-5 text-ink-500" />
          <p className="text-lg font-semibold tracking-tight">{countLabel}</p>
        </div>
        <div className="w-full sm:max-w-xs">
          <Field label="Search" htmlFor="audience-search">
            <TextField
              id="audience-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search email…"
            />
          </Field>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Loading subscribers…" />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : !data?.subscribers.length ? (
        <EmptyState
          title={debouncedQ ? "No matches" : "No email subscribers yet"}
          description={
            debouncedQ
              ? "No subscribers match that search."
              : "Subscribers appear here once people opt in."
          }
        />
      ) : (
        <Table
          head={
            <>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Subscribed</Th>
            </>
          }
        >
          {data.subscribers.map((row) => (
            <tr key={row.id}>
              <Td className="text-ink-900">{row.email || "—"}</Td>
              <Td>
                <StatusBadge
                  tone={row.status === "ACTIVE" ? "success" : "neutral"}
                >
                  {row.status}
                </StatusBadge>
              </Td>
              <Td className="text-ink-500">{formatDate(row.subscribedAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </DashboardLayout>
  );
}
