import { Fragment, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import useSWR from "swr";
import { Edit3, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import EventSalesPanel from "@/components/EventSalesPanel";
import { useResumeAction } from "@/hooks/useResumeAction";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  LinkButton,
  PageHeader,
  StatusBadge,
  Table,
  Td,
  Th,
} from "@/components/ui";

type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";

type EventRow = {
  id: number;
  title: string;
  slug: string;
  startsAt: string;
  status: EventStatus;
  venue: string | null;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as EventRow[];
};

function statusTone(
  status: EventStatus
): "neutral" | "success" | "danger" | "info" {
  if (status === "PUBLISHED") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "COMPLETED") return "info";
  return "neutral";
}

export default function EventsListPage() {
  const { data: events, error, isLoading, mutate } = useSWR(
    "/api/events",
    fetcher
  );
  const [salesOpenId, setSalesOpenId] = useState<number | null>(null);

  useResumeAction({
    domain: "event",
    rows: events,
    onNew: () => {
      window.location.href = "/dashboard/events?resume=event:new";
    },
    onEdit: (row) => {
      window.location.href = `/dashboard/events?resume=event:${row.id}`;
    },
  });

  const remove = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json();
      alert(json.message || "Delete failed");
      return;
    }
    mutate();
  };

  return (
    <DashboardLayout>
      <Head>
        <title>All events — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="All events"
        subtitle="Every event in the gallery."
        actions={
          <LinkButton href="/dashboard/events" variant="primary">
            <Plus className="h-4 w-4" /> New event
          </LinkButton>
        }
      />

      {isLoading ? (
        <LoadingState label="Loading events…" />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => mutate()} />
      ) : !events?.length ? (
        <EmptyState
          title="No events yet"
          description="Create the first one."
          action={
            <LinkButton href="/dashboard/events">
              <Plus className="h-4 w-4" /> New event
            </LinkButton>
          }
        />
      ) : (
        <Table
          head={
            <>
              <Th>Title</Th>
              <Th>Starts</Th>
              <Th>Status</Th>
              <Th>Venue</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {events.map((event) => (
            <Fragment key={event.id}>
              <tr>
                <Td>
                  <Link
                    href={`/dashboard/events?resume=event:${event.id}`}
                    className="font-medium text-ink-900 hover:text-accent-700"
                  >
                    {event.title}
                  </Link>
                  <div className="text-xs text-ink-400">{event.slug}</div>
                </Td>
                <Td className="text-ink-600">
                  {new Date(event.startsAt).toLocaleString()}
                </Td>
                <Td>
                  <StatusBadge tone={statusTone(event.status)}>
                    {event.status}
                  </StatusBadge>
                </Td>
                <Td className="text-ink-600">{event.venue || "—"}</Td>
                <Td>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      onClick={() =>
                        setSalesOpenId(
                          salesOpenId === event.id ? null : event.id
                        )
                      }
                      title="Ticket sales"
                    >
                      {salesOpenId === event.id ? "Hide" : "Sales"}
                    </Button>
                    <LinkButton
                      href={`/dashboard/events?resume=event:${event.id}`}
                      variant="ghost"
                      className="px-2 py-1"
                      aria-label="Edit"
                    >
                      <Edit3 className="h-4 w-4" />
                    </LinkButton>
                    <Button
                      variant="ghost"
                      className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => remove(event.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Td>
              </tr>
              {salesOpenId === event.id && (
                <tr key={`${event.id}-sales`}>
                  <Td colSpan={5} className="bg-ink-50/60 px-4 py-6">
                    <EventSalesPanel eventId={event.id} />
                  </Td>
                </tr>
              )}
            </Fragment>
          ))}
        </Table>
      )}
    </DashboardLayout>
  );
}
