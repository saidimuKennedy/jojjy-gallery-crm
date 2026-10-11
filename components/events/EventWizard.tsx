import React, { useEffect, useMemo, useRef, useState } from "react";
import MediaUrlField from "@/components/Admin/MediaUrlField";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  Alert,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  CurrencyField,
  DateTimeField,
  Field,
  FormActions,
  OptionalSection,
  SectionHeading,
  Select,
  TextArea,
  TextField,
  WizardSteps,
} from "@/components/ui";

type TicketMode = "TICKETED" | "RSVP_ONLY";

/** Event slugs match the events API route (no image-style fallback). */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-*|-*$/g, "");
}

interface DraftTicketType {
  /** Existing DB id (edit flow only) so counters/updates can be reconciled. */
  id?: number;
  name: string;
  description: string;
  price: string;
  currency: string;
  quantity: string;
  salesStart: string;
  salesEnd: string;
  /** Read-only counters reported by the server (edit flow). */
  issued: number;
  reserved: number;
}

interface WizardDraft {
  step: number;
  title: string;
  slug: string;
  description: string;
  venue: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  directions: string;
  openingHours: string;
  artistTalkAt: string;
  ticketMode: TicketMode;
  /** Explicit acknowledgement that RSVP-only means no checkout. */
  rsvpModeConfirmed: boolean;
  ticketTypes: DraftTicketType[];
  publishAt: string;
}

export interface EventWizardEvent {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  venue: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  directions: string | null;
  openingHours: string | null;
  artistTalkAt: string | null;
  publishAt?: string | null;
  ticketMode?: TicketMode;
  ticketTypes?: {
    id: number;
    name: string;
    description: string | null;
    price: number;
    quantity: number;
    quantitySold: number;
    quantityReserved: number;
    salesStart: string | null;
    salesEnd: string | null;
  }[];
}

const STEP_LABELS = [
  "Event basics",
  "When & where",
  "Cover image",
  "Tickets",
  "Review & publish",
];

const inputHint = "Stored in UTC, shown in your local time.";

const EMPTY: WizardDraft = {
  step: 0,
  title: "",
  slug: "",
  description: "",
  venue: "",
  imageUrl: "",
  startsAt: "",
  endsAt: "",
  directions: "",
  openingHours: "",
  artistTalkAt: "",
  ticketMode: "TICKETED",
  rsvpModeConfirmed: false,
  ticketTypes: [],
  publishAt: "",
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftFromEvent(event: EventWizardEvent): WizardDraft {
  return {
    step: 0,
    title: event.title,
    slug: event.slug,
    description: event.description ?? "",
    venue: event.venue ?? "",
    imageUrl: event.imageUrl ?? "",
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    directions: event.directions ?? "",
    openingHours: event.openingHours ?? "",
    artistTalkAt: toLocalInput(event.artistTalkAt),
    ticketMode: event.ticketMode ?? "TICKETED",
    rsvpModeConfirmed: (event.ticketMode ?? "TICKETED") === "RSVP_ONLY",
    ticketTypes: (event.ticketTypes ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? "",
      price: String(t.price),
      currency: "USD",
      quantity: String(t.quantity),
      salesStart: toLocalInput(t.salesStart),
      salesEnd: toLocalInput(t.salesEnd),
      issued: t.quantitySold,
      reserved: t.quantityReserved,
    })),
    publishAt: toLocalInput(event.publishAt),
  };
}

function newTicketType(): DraftTicketType {
  return {
    name: "",
    description: "",
    price: "0",
    currency: "USD",
    quantity: "100",
    salesStart: "",
    salesEnd: "",
    issued: 0,
    reserved: 0,
  };
}

interface Step1Errors {
  title?: string;
}

interface TicketErrorMap {
  [index: number]: string;
}

export default function EventWizard({
  event,
  onSaved,
  onCancel,
}: {
  /** Present = edit flow. Absent = create flow. */
  event?: EventWizardEvent;
  onSaved?: () => void;
  onCancel?: () => void;
} = {}) {
  const isEdit = Boolean(event);
  const initial = useMemo(
    () => (event ? draftFromEvent(event) : EMPTY),
    [event]
  );
  const [draft, setDraft] = useState<WizardDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "publish" | "schedule">(null);

  // Keep the form in sync when the edit target changes.
  useEffect(() => {
    setDraft(initial);
  }, [initial]);

  const draftKey = isEdit
    ? `jenga:crm:draft:event:${event!.id}`
    : "jenga:crm:draft:event:new";

  const { recovered, savedAt, clear } = useFormDraft<WizardDraft>({
    draftKey,
    values: draft,
    emptyValues: initial,
    onRestore: setDraft,
  });

  const patch = (p: Partial<WizardDraft>) => setDraft((d) => ({ ...d, ...p }));

  const goTo = (step: number) =>
    patch({ step: Math.max(0, Math.min(STEP_LABELS.length - 1, step)) });

  // ---- Validation ----------------------------------------------------------

  const step1Errors = useMemo<Step1Errors>(() => {
    const errs: Step1Errors = {};
    if (!draft.title.trim()) errs.title = "Title is required.";
    return errs;
  }, [draft.title]);

  const whenErrors = useMemo(() => {
    const errs: string[] = [];
    if (!draft.startsAt) errs.push("Start date/time is required.");
    if (
      draft.endsAt &&
      draft.startsAt &&
      new Date(draft.endsAt) <= new Date(draft.startsAt)
    ) {
      errs.push("End must be after start.");
    }
    return errs;
  }, [draft.startsAt, draft.endsAt]);

  const imageErrors = useMemo(
    () =>
      draft.imageUrl.trim()
        ? []
        : [
            "A cover image is required. Upload one or paste a link so the event never ships with a broken placeholder.",
          ],
    [draft.imageUrl]
  );

  const ticketErrors = useMemo<TicketErrorMap>(() => {
    if (draft.ticketMode === "RSVP_ONLY") return {};
    const errs: TicketErrorMap = {};
    draft.ticketTypes.forEach((tt, i) => {
      if (!tt.name.trim()) {
        errs[i] = "Name is required.";
        return;
      }
      const price = parseFloat(tt.price || "0");
      if (isNaN(price) || price < 0) {
        errs[i] = "Price must be 0 or more (use 0 for free).";
        return;
      }
      const qty = parseInt(tt.quantity || "0", 10);
      if (isNaN(qty) || !Number.isInteger(qty) || qty < 0) {
        errs[i] = "Quantity must be a whole number of 0 or more.";
        return;
      }
      const floor = tt.issued + tt.reserved;
      if (qty < floor) {
        errs[i] = `Quantity cannot drop below issued + reserved (${floor}).`;
        return;
      }
      if (
        tt.salesStart &&
        tt.salesEnd &&
        new Date(tt.salesEnd) <= new Date(tt.salesStart)
      ) {
        errs[i] = "Sales end must be after sales start.";
      }
    });
    return errs;
  }, [draft.ticketMode, draft.ticketTypes]);

  const rsvpConfirmed =
    draft.ticketMode !== "RSVP_ONLY" || draft.rsvpModeConfirmed;

  const stepErrors: Record<number, string[]> = {
    0: Object.values(step1Errors).filter(Boolean) as string[],
    1: whenErrors,
    2: imageErrors,
    3: Object.values(ticketErrors),
  };

  const canPublish =
    stepErrors[0].length === 0 &&
    stepErrors[1].length === 0 &&
    // In the create flow the cover image is required to publish; in edit the
    // event already has (or will keep) whatever image is on the row.
    (isEdit || stepErrors[2].length === 0) &&
    Object.keys(ticketErrors).length === 0 &&
    rsvpConfirmed &&
    (draft.ticketMode === "RSVP_ONLY" || draft.ticketTypes.length > 0);

  const canAdvance = stepErrors[draft.step]?.length === 0 && rsvpConfirmed;

  // ---- Ticket editing ------------------------------------------------------

  const addTicket = () =>
    patch({ ticketTypes: [...draft.ticketTypes, newTicketType()] });

  const updateTicket = (i: number, p: Partial<DraftTicketType>) =>
    patch({
      ticketTypes: draft.ticketTypes.map((t, idx) =>
        idx === i ? { ...t, ...p } : t
      ),
    });

  const removeTicket = (i: number) =>
    patch({ ticketTypes: draft.ticketTypes.filter((_, idx) => idx !== i) });

  // ---- Persist -------------------------------------------------------------

  const buildPayload = (
    action: "draft" | "publish" | "schedule"
  ): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      title: draft.title.trim(),
      slug: slugify(draft.slug.trim() || draft.title),
      description: draft.description.trim() || null,
      venue: draft.venue.trim() || null,
      imageUrl: draft.imageUrl.trim() || null,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : null,
      directions: draft.directions.trim() || null,
      openingHours: draft.openingHours.trim() || null,
      artistTalkAt: draft.artistTalkAt
        ? new Date(draft.artistTalkAt).toISOString()
        : null,
      ticketMode: draft.ticketMode,
    };
    if (action === "draft") {
      payload.status = "DRAFT";
      payload.publishAt = null;
    } else if (action === "publish") {
      payload.status = "PUBLISHED";
      payload.publishAt = null;
    } else {
      payload.status = "DRAFT";
      payload.publishAt = draft.publishAt
        ? new Date(draft.publishAt).toISOString()
        : null;
    }

    if (draft.ticketMode === "TICKETED") {
      payload.ticketTypes = draft.ticketTypes
        .filter((tt) => tt.name.trim())
        .map((tt) => ({
          id: tt.id,
          name: tt.name.trim(),
          description: tt.description.trim() || null,
          price: parseFloat(tt.price || "0"),
          currency: tt.currency,
          quantity: parseInt(tt.quantity || "0", 10),
          salesStart: tt.salesStart
            ? new Date(tt.salesStart).toISOString()
            : null,
          salesEnd: tt.salesEnd ? new Date(tt.salesEnd).toISOString() : null,
        }));
    } else {
      payload.ticketTypes = [];
    }
    return payload;
  };

  const submit = async (action: "draft" | "publish" | "schedule") => {
    // Schedule requires an explicit publish time in the future.
    if (action === "schedule") {
      if (!draft.publishAt) {
        setError("Choose a publication date/time before scheduling.");
        setConfirm(null);
        return;
      }
      if (new Date(draft.publishAt) <= new Date()) {
        setError("Scheduled publication must be in the future.");
        setConfirm(null);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        isEdit ? `/api/events/${event!.id}` : "/api/events",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(action)),
        }
      );
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.message || "Could not save the event.");
      }
      clear();
      setConfirm(null);
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the event."
      );
    } finally {
      setBusy(false);
    }
  };

  // ---- Render helpers ------------------------------------------------------

  const stepTitle = draft.title.trim() || "Untitled event";
  const stepSlug = slugify(draft.slug.trim() || draft.title) || "—";

  return (
    <Card className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">
            {isEdit ? "Edit event" : "Create an event"}
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Five short steps. Your progress is saved as you go — leave and come
            back anytime.
          </p>
        </div>
        {isEdit && onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Close
          </Button>
        )}
      </div>

      {recovered && (
        <Alert tone="info">Recovered your unsaved draft.</Alert>
      )}
      {savedAt && (
        <p className="text-xs text-ink-400">
          Draft saved locally at {savedAt.toLocaleTimeString()}.
        </p>
      )}
      {error && <Alert tone="danger">{error}</Alert>}

      <WizardSteps steps={STEP_LABELS} current={draft.step} />

      {/* Step 1 — Event basics ------------------------------------------- */}
      {draft.step === 0 && (
        <div className="space-y-4">
          <Field
            label="Event title"
            required
            error={step1Errors.title}
            hint="Shown to customers."
          >
            <TextField
              value={draft.title}
              autoFocus
              onChange={(e) => {
                const title = e.target.value;
                patch({ title, slug: slugify(title) });
              }}
            />
          </Field>
          <Field label="Short description" hint="One or two sentences.">
            <TextArea
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={3}
            />
          </Field>
          <div className="rounded-card border border-border bg-ink-50/60 px-4 py-3">
            <p className="text-xs font-medium text-ink-500">Preview</p>
            <p className="mt-1 text-base font-semibold text-ink-900">
              {stepTitle}
            </p>
            <p className="text-xs text-ink-400">
              /events/{stepSlug}
              <span className="ml-2 text-ink-300">
                (slug generated from the title)
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Step 2 — When and where ----------------------------------------- */}
      {draft.step === 1 && (
        <div className="space-y-4">
          <SectionHeading>Schedule</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts at" required hint={inputHint}>
              <DateTimeField
                value={draft.startsAt}
                onChange={(e) => patch({ startsAt: e.target.value })}
              />
            </Field>
            <Field label="Ends at" hint={inputHint}>
              <DateTimeField
                value={draft.endsAt}
                onChange={(e) => patch({ endsAt: e.target.value })}
              />
            </Field>
          </div>
          {whenErrors.length > 0 && (
            <Alert tone="danger" title="Please fix:">
              <ul className="list-disc pl-5">
                {whenErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </Alert>
          )}

          <SectionHeading className="pt-2">Location</SectionHeading>
          <Field label="Venue">
            <TextField
              value={draft.venue}
              onChange={(e) => patch({ venue: e.target.value })}
            />
          </Field>
          <Field label="Directions" hint="A Google Maps link works well.">
            <TextField
              value={draft.directions}
              onChange={(e) => patch({ directions: e.target.value })}
              placeholder="https://maps.google.com/…"
            />
          </Field>
          <Field label="Opening hours" hint="e.g. 9:00 AM – 6:00 PM">
            <TextField
              value={draft.openingHours}
              onChange={(e) => patch({ openingHours: e.target.value })}
            />
          </Field>

          <OptionalSection
            title="Artist talk (optional)"
            hint="Add a time"
            defaultOpen={Boolean(draft.artistTalkAt)}
          >
            <Field label="Artist talk at" hint={inputHint}>
              <DateTimeField
                value={draft.artistTalkAt}
                onChange={(e) => patch({ artistTalkAt: e.target.value })}
              />
            </Field>
          </OptionalSection>
        </div>
      )}

      {/* Step 3 — Event image -------------------------------------------- */}
      {draft.step === 2 && (
        <div className="space-y-4">
          <Alert tone={imageErrors.length ? "warning" : "info"}>
            {imageErrors.length
              ? "A cover image is required — the public event page has no safe fallback, so publishing is blocked until one is set."
              : "This image is the cover shown on the public event page."}
          </Alert>
          <MediaUrlField
            label="Cover image"
            value={draft.imageUrl}
            onChange={(url) => patch({ imageUrl: url })}
          />
          {draft.imageUrl && (
            <div>
              <SectionHeading>Display preview</SectionHeading>
              <div className="overflow-hidden rounded-card border border-border">
                <div className="aspect-[16/9] w-full bg-ink-100">
                  <img
                    src={draft.imageUrl}
                    alt="Event cover preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="px-4 py-3">
                  <p className="text-base font-semibold text-ink-900">
                    {stepTitle}
                  </p>
                  <p className="text-xs text-ink-400">
                    {draft.startsAt
                      ? new Date(draft.startsAt).toLocaleString()
                      : "No date"}
                    {draft.venue ? ` · ${draft.venue}` : ""}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-400">
                Covers are cropped to 16:9. Keep the subject centered.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 4 — Tickets ------------------------------------------------ */}
      {draft.step === 3 && (
        <div className="space-y-4">
          <Field
            label="Admission mode"
            hint="RSVP-only events show no checkout. This is never inferred from having no tickets — choose it explicitly."
          >
            <Select
              value={draft.ticketMode}
              onChange={(e) => {
                const mode = e.target.value as TicketMode;
                patch({
                  ticketMode: mode,
                  rsvpModeConfirmed:
                    mode === "RSVP_ONLY" ? draft.rsvpModeConfirmed : false,
                });
              }}
            >
              <option value="TICKETED">Ticketed</option>
              <option value="RSVP_ONLY">RSVP only (no tickets)</option>
            </Select>
          </Field>

          {draft.ticketMode === "RSVP_ONLY" ? (
            <div className="space-y-3">
              <Alert tone="info">
                RSVP-only: customers register interest but never check out, and
                no tickets are issued.
              </Alert>
              <label className="flex items-start gap-3 rounded-card border border-border px-4 py-3 text-sm text-ink-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.rsvpModeConfirmed}
                  onChange={(e) =>
                    patch({ rsvpModeConfirmed: e.target.checked })
                  }
                />
                I understand this event is intentionally RSVP-only and has no
                ticket sales.
              </label>
            </div>
          ) : (
            <>
              {draft.ticketTypes.length === 0 && (
                <Alert tone="info">
                  Add at least one ticket type to publish this event.
                </Alert>
              )}

              {draft.ticketTypes.map((tt, i) => {
                const allocated = parseInt(tt.quantity || "0", 10) || 0;
                const remaining = Math.max(
                  0,
                  allocated - tt.issued - tt.reserved
                );
                const isFree = parseFloat(tt.price || "0") === 0;
                return (
                  <div
                    key={tt.id ?? `new-${i}`}
                    className="space-y-3 rounded-card border border-border p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink-700">
                          Ticket type {i + 1}
                        </p>
                        {isFree && <Chip tone="success">Free</Chip>}
                      </div>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => removeTicket(i)}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name" required>
                        <TextField
                          value={tt.name}
                          placeholder="General admission"
                          onChange={(e) =>
                            updateTicket(i, { name: e.target.value })
                          }
                        />
                      </Field>
                      <Field
                        label="Price"
                        required
                        error={
                          ticketErrors[i] &&
                          /price/i.test(ticketErrors[i])
                            ? ticketErrors[i]
                            : undefined
                        }
                        hint="Enter 0 for a free ticket."
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-ink-500">USD</span>
                          <CurrencyField
                            value={tt.price}
                            onChange={(e) =>
                              updateTicket(i, { price: e.target.value })
                            }
                          />
                        </div>
                      </Field>
                    </div>

                    <Field label="Description" hint="Optional, shown at checkout.">
                      <TextField
                        value={tt.description}
                        onChange={(e) =>
                          updateTicket(i, { description: e.target.value })
                        }
                      />
                    </Field>

                    <Field
                      label="Quantity / allocation"
                      required
                      error={ticketErrors[i]}
                    >
                      <TextField
                        type="number"
                        min="0"
                        value={tt.quantity}
                        onChange={(e) =>
                          updateTicket(i, { quantity: e.target.value })
                        }
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Allocated", value: allocated },
                        { label: "Issued", value: tt.issued },
                        { label: "Reserved", value: tt.reserved },
                        { label: "Remaining", value: remaining },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-field border border-border bg-ink-50/60 px-3 py-2"
                        >
                          <p className="text-[0.7rem] font-medium text-ink-500">
                            {s.label}
                          </p>
                          <p className="text-sm font-semibold text-ink-900">
                            {s.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <OptionalSection
                      title="Sales window (optional)"
                      hint="Start / end"
                      defaultOpen={Boolean(tt.salesStart || tt.salesEnd)}
                    >
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Sales start" hint={inputHint}>
                          <DateTimeField
                            value={tt.salesStart}
                            onChange={(e) =>
                              updateTicket(i, { salesStart: e.target.value })
                            }
                          />
                        </Field>
                        <Field label="Sales end" hint={inputHint}>
                          <DateTimeField
                            value={tt.salesEnd}
                            onChange={(e) =>
                              updateTicket(i, { salesEnd: e.target.value })
                            }
                          />
                        </Field>
                      </div>
                    </OptionalSection>
                  </div>
                );
              })}

              <Button variant="secondary" onClick={addTicket}>
                Add ticket type
              </Button>
              <p className="text-xs text-ink-400">
                Allocation cannot drop below the quantity already issued or
                reserved. Free tickets are allowed — set price to 0.
              </p>
            </>
          )}
        </div>
      )}

      {/* Step 5 — Review & publish --------------------------------------- */}
      {draft.step === 4 && (
        <div className="space-y-5">
          <SectionHeading>Customer-facing preview</SectionHeading>
          <div className="overflow-hidden rounded-card border border-border">
            {draft.imageUrl ? (
              <img
                src={draft.imageUrl}
                alt=""
                className="aspect-[16/9] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-ink-100 text-xs text-ink-400">
                No cover image
              </div>
            )}
            <div className="space-y-1 px-4 py-3">
              <p className="text-lg font-semibold text-ink-900">{stepTitle}</p>
              <p className="text-sm text-ink-600">
                {draft.startsAt
                  ? new Date(draft.startsAt).toLocaleString()
                  : "No date"}
                {draft.venue ? ` · ${draft.venue}` : ""}
              </p>
              {draft.description && (
                <p className="text-sm text-ink-600">{draft.description}</p>
              )}
              {draft.openingHours && (
                <p className="text-xs text-ink-400">
                  Open {draft.openingHours}
                </p>
              )}
            </div>
          </div>

          <SectionHeading>Ticket summary</SectionHeading>
          {draft.ticketMode === "RSVP_ONLY" ? (
            <Alert tone="info">
              RSVP-only — no tickets will be sold and no checkout is shown.
            </Alert>
          ) : draft.ticketTypes.length === 0 ? (
            <Alert tone="warning">No ticket types configured.</Alert>
          ) : (
            <div className="overflow-hidden rounded-card border border-border">
              {draft.ticketTypes.map((tt, i) => {
                const allocated = parseInt(tt.quantity || "0", 10) || 0;
                const remaining = Math.max(
                  0,
                  allocated - tt.issued - tt.reserved
                );
                const price = parseFloat(tt.price || "0");
                return (
                  <div
                    key={tt.id ?? `sum-${i}`}
                    className="border-b border-border px-4 py-3 text-sm last:border-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-ink-900">
                        {tt.name || "Untitled"}
                      </span>
                      <StatusPill price={price} currency={tt.currency} />
                    </div>
                    <p className="mt-1 text-xs text-ink-500">
                      {allocated} allocated · {tt.issued} issued ·{" "}
                      {tt.reserved} reserved · {remaining} remaining
                    </p>
                    <p className="text-xs text-ink-400">
                      {tt.salesStart || tt.salesEnd
                        ? `Sales: ${
                            tt.salesStart
                              ? new Date(tt.salesStart).toLocaleString()
                              : "—"
                          } → ${
                            tt.salesEnd
                              ? new Date(tt.salesEnd).toLocaleString()
                              : "—"
                          }`
                        : "No sales window (always on sale)"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <Field
            label="Schedule publication"
            hint="Optional — used by 'Schedule publication' below. Leave blank to publish immediately."
          >
            <DateTimeField
              value={draft.publishAt}
              onChange={(e) => patch({ publishAt: e.target.value })}
            />
          </Field>

          {!canPublish && (
            <Alert tone="warning">
              Complete required details and a valid ticket configuration before
              publishing. You can still save a draft.
            </Alert>
          )}

          <FormActions className="flex-wrap">
            <Button
              variant="secondary"
              onClick={() => submit("draft")}
              disabled={busy}
            >
              Save draft
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirm("schedule")}
              disabled={busy || !canPublish}
            >
              Schedule publication
            </Button>
            <Button
              onClick={() => setConfirm("publish")}
              disabled={busy || !canPublish}
            >
              Publish now
            </Button>
          </FormActions>
        </div>
      )}

      {/* Back / Continue --------------------------------------------------- */}
      {draft.step < STEP_LABELS.length - 1 ? (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <Button
            variant="secondary"
            disabled={draft.step === 0}
            onClick={() => goTo(draft.step - 1)}
          >
            Back
          </Button>
          <Button disabled={!canAdvance} onClick={() => goTo(draft.step + 1)}>
            {draft.step === 0 ? "Save draft & continue" : "Continue"}
          </Button>
        </div>
      ) : (
        <div className="flex justify-start border-t border-border pt-4">
          <Button variant="secondary" onClick={() => goTo(draft.step - 1)}>
            Back
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirm === "publish"}
        title="Publish this event now?"
        confirmLabel="Publish now"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => submit("publish")}
        body={
          <>
            <p>
              <span className="font-medium">{stepTitle}</span> becomes visible
              on the public site immediately.
            </p>
            {draft.ticketMode === "RSVP_ONLY" ? (
              <p className="mt-2 text-ink-500">RSVP-only — no ticket sales.</p>
            ) : (
              <p className="mt-2 text-ink-500">
                {draft.ticketTypes.length} ticket type(s) will go on sale.
              </p>
            )}
          </>
        }
      />
      <ConfirmDialog
        open={confirm === "schedule"}
        title="Schedule publication?"
        confirmLabel="Schedule"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => submit("schedule")}
        body={
          <p>
            <span className="font-medium">{stepTitle}</span> will publish
            automatically on{" "}
            <span className="font-medium">
              {draft.publishAt
                ? new Date(draft.publishAt).toLocaleString()
                : "—"}
            </span>
            . Until then it stays a draft.
          </p>
        }
      />
    </Card>
  );
}

function StatusPill({
  price,
  currency,
}: {
  price: number;
  currency: string;
}) {
  if (price === 0) return <Chip tone="success">Free</Chip>;
  return (
    <Chip tone="info">
      {currency} {price.toFixed(2)}
    </Chip>
  );
}
