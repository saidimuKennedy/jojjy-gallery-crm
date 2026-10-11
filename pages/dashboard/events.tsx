import { useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import useSWR from "swr";
import { List } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import EventWizard, {
  type EventWizardEvent,
} from "@/components/events/EventWizard";
import { useResumeAction } from "@/hooks/useResumeAction";
import { Button, LinkButton, PageHeader } from "@/components/ui";

type EventRow = EventWizardEvent;

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to fetch");
  return json.data as EventRow[];
};

export default function EventsPage() {
  const router = useRouter();
  const { data: events, mutate } = useSWR("/api/events", fetcher);
  const [editingId, setEditingId] = useState<number | null>(null);
  const wizardRef = useRef<HTMLDivElement>(null);

  const editing = events?.find((e) => e.id === editingId) ?? null;

  const scrollToWizard = () =>
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const openCreate = () => {
    setEditingId(null);
    scrollToWizard();
  };

  const openEdit = (row: EventRow) => {
    setEditingId(row.id);
    scrollToWizard();
  };

  useResumeAction({
    domain: "event",
    rows: events,
    onNew: openCreate,
    onEdit: (row) => openEdit(row as EventRow),
  });

  const afterSave = async () => {
    setEditingId(null);
    await mutate();
    void router.push("/dashboard/events/list");
  };

  return (
    <DashboardLayout>
      <Head>
        <title>New event — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title={editing ? "Edit event" : "New event"}
        subtitle="A short, guided flow — your progress is saved as you go."
        actions={
          <LinkButton href="/dashboard/events/list" variant="secondary">
            <List className="h-4 w-4" /> All events
          </LinkButton>
        }
      />

      <div ref={wizardRef} className="scroll-mt-6">
        <EventWizard
          key={editing?.id ?? "new"}
          event={editing ?? undefined}
          onSaved={afterSave}
          onCancel={() => setEditingId(null)}
        />
      </div>

      {!editing && (
        <div className="mt-8">
          <LinkButton href="/dashboard/events/list" variant="ghost">
            <List className="h-4 w-4" /> View all events
          </LinkButton>
        </div>
      )}

      {editing && (
        <div className="mt-8">
          <Button variant="ghost" onClick={openCreate}>
            Start a new event instead
          </Button>
        </div>
      )}
    </DashboardLayout>
  );
}
