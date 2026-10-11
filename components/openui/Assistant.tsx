import { useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import {
  actionsForPermissions,
  resolveIntent,
  type OpenUiAction,
} from "@/components/openui/library";
import { Button } from "@/components/ui";

interface Message {
  role: "user" | "assistant";
  text: string;
  action?: OpenUiAction;
}

/**
 * OpenUI assistant surface. With no model provider configured it runs in
 * deterministic intent-routing mode: it maps staff intent to an allowlisted
 * action and opens the reviewed workflow. It never performs a write itself, and
 * it never sees database tools.
 */
export default function Assistant() {
  const router = useRouter();
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Tell me what you want to do — e.g. “create event”, “scan tickets”, or “show events”. I’ll open the right workflow; you confirm every change.",
    },
  ]);

  const submit = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);

    let reply = "";
    let action: OpenUiAction | undefined;
    try {
      const res = await fetch("/api/openui/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Assistant request failed");
      reply = typeof json.data?.reply === "string" ? json.data.reply : "";
      const actionId = json.data?.actionId;
      action = actionsForPermissions(permissions).find((item) => item.id === actionId);
    } catch {
      // Preserve basic navigation when the assistant endpoint is unavailable.
      action = resolveIntent(text, permissions) ?? undefined;
    }

    if (!action) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text:
            reply ||
            "I can help with events, ticket issuance, check-in, refunds, and reports. Try one of those.",
        },
      ]);
      return;
    }

    if (action.kind === "read" && action.apiPath) {
      try {
        const res = await fetch("/api/openui/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionId: action.id }),
        });
        const json = await res.json();
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: res.ok
              ? json.data?.summary || reply || "Here’s what I found."
              : json.message || "That action isn’t available to you.",
            action,
          },
        ]);
      } catch {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Something went wrong. Please retry." },
        ]);
      }
      return;
    }

    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        text: `${reply || action.description}${
          action.requiresConfirmation
            ? " You’ll review and confirm before anything changes."
            : ""
        }`,
        action,
      },
    ]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-40 rounded-full bg-accent-600 px-5 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-accent-700"
        aria-label="Toggle assistant"
      >
        Assistant
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="fixed bottom-24 right-6 z-40 flex h-[28rem] w-80 flex-col overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-2xl"
        >
          <div className="border-b border-ink-100 px-5 py-3">
            <p className="text-sm font-semibold text-ink-800">
              OpenUI assistant
            </p>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i}>
                <p
                  className={
                    m.role === "user"
                      ? "ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-accent-50 px-3 py-2 text-sm text-ink-900"
                      : "w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-ink-50 px-3 py-2 text-sm text-ink-700"
                  }
                >
                  {m.text}
                </p>
                {m.action?.route && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push(m.action!.route!);
                      setOpen(false);
                    }}
                    className="mt-2 w-full rounded-full bg-accent-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-700"
                  >
                    {m.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-ink-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
              placeholder="e.g. create event"
              className="flex-1 rounded-full border border-ink-200 px-4 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-100"
            />
            <Button onClick={submit}>Go</Button>
          </div>
        </div>
      )}
    </>
  );
}
