/**
 * Allowlisted OpenUI action registry for the CRM.
 *
 * OpenUI helps staff express intent and renders supported workflow components,
 * but the source of truth is the existing CRM APIs/database. Every action here
 * maps to a real CRM route and a required permission. Write actions NEVER
 * execute from model output directly — they resolve to a deterministic workflow
 * route that runs the usual confirmation + authenticated API call. The model
 * is never given Prisma/database tools.
 *
 * To generate the OpenUI system prompt + serialized spec for a self-hosted
 * runtime (once a model provider is configured), define a `createLibrary()`
 * result whose components/actions mirror this registry and run:
 *
 *   npx @openuidev/cli@latest generate components/openui/library.ts \
 *     --spec -o components/openui/crm.prompt.md
 *
 * The provider (OpenAI-compatible base URL + key) is a deployment prerequisite;
 * until it is set, the assistant runs in deterministic routing mode below.
 */

export type ActionKind = "read" | "workflow";

export interface OpenUiAction {
  id: string;
  label: string;
  description: string;
  permission: string;
  kind: ActionKind;
  /** For read actions: the existing CRM API path (GET). */
  apiPath?: string;
  /** For workflow actions: the CRM page that performs the confirmed write. */
  route?: string;
  /** Keywords used by deterministic intent routing (no-model fallback). */
  keywords: string[];
  /** Write workflows that must show a review/confirmation step. */
  requiresConfirmation?: boolean;
}

export const OPENUI_ACTIONS: OpenUiAction[] = [
  {
    id: "events.list",
    label: "List events",
    description: "Show current events and their status.",
    permission: "events:read",
    kind: "read",
    apiPath: "/api/events",
    keywords: ["event", "events", "list events", "show events"],
  },
  {
    id: "events.create",
    label: "Create event",
    description: "Start the guided event wizard.",
    permission: "events:write",
    kind: "workflow",
    route: "/dashboard/events",
    keywords: ["create event", "new event", "add event", "wizard"],
    requiresConfirmation: true,
  },
  {
    id: "tickets.issueComplimentary",
    label: "Issue complimentary tickets",
    description: "Open the complimentary issuance wizard for an event.",
    permission: "tickets:issue-complimentary",
    kind: "workflow",
    route: "/dashboard/reports",
    keywords: ["complimentary", "comp ticket", "free ticket", "guest list"],
    requiresConfirmation: true,
  },
  {
    id: "tickets.checkIn",
    label: "Open check-in",
    description: "Open the door check-in scanner.",
    permission: "tickets:check-in",
    kind: "workflow",
    route: "/dashboard/checkin",
    keywords: ["check in", "check-in", "scan", "door", "qr"],
  },
  {
    id: "refunds.request",
    label: "Request a refund",
    description: "Open the refund request flow.",
    permission: "orders:refund-request",
    kind: "workflow",
    route: "/dashboard/refunds",
    keywords: ["refund", "refund request", "return ticket"],
    requiresConfirmation: true,
  },
  {
    id: "refunds.approve",
    label: "Approve refunds",
    description: "Open the refund approval queue.",
    permission: "orders:refund-approve",
    kind: "workflow",
    route: "/dashboard/refunds",
    keywords: ["approve refund", "refund approval"],
    requiresConfirmation: true,
  },
  {
    id: "reports.event",
    label: "Event report",
    description: "Open event reporting.",
    permission: "reporting:read",
    kind: "workflow",
    route: "/dashboard/reports",
    keywords: ["report", "sales", "attendees", "checked in", "how many"],
  },
];

export function actionsForPermissions(permissions: string[]): OpenUiAction[] {
  return OPENUI_ACTIONS.filter((a) => permissions.includes(a.permission));
}

/**
 * Deterministic intent router. Used when no model provider is configured, and
 * as the fallback when a model is unsure. Returns the best matching action the
 * user is permitted to use, or null.
 */
export function resolveIntent(
  text: string,
  permissions: string[]
): OpenUiAction | null {
  const q = text.toLowerCase().trim();
  if (!q) return null;
  const allowed = actionsForPermissions(permissions);
  let best: { action: OpenUiAction; score: number } | null = null;
  for (const action of allowed) {
    for (const kw of action.keywords) {
      if (q.includes(kw)) {
        const score = kw.length;
        if (!best || score > best.score) best = { action, score };
      }
    }
  }
  return best?.action ?? null;
}
