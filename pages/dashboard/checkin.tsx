import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Alert,
  Button,
  Card,
  Field,
  PageHeader,
  Select,
  StatusBadge,
  TextField,
} from "@/components/ui";

interface EventOption {
  id: number;
  title: string;
  startsAt: string;
  status: string;
  ticketTypeCount: number;
}

interface ScanResult {
  ok: boolean;
  message: string;
  code?: string;
  ticketType?: string;
  holderName?: string | null;
  holderEmail?: string | null;
  checkedInAt?: string | null;
  source?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Failed to load events");
  return json.data as EventOption[];
};

export default function CheckInPage() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const canCorrect = permissions.includes("tickets:check-in-correct");

  const { data: events, error: eventsError } = useSWR<EventOption[]>(
    "/api/tickets/events",
    fetcher
  );
  const [eventId, setEventId] = useState<string>("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [log, setLog] = useState<ScanResult[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimer = useRef<number | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId && events && events.length > 0) {
      setEventId(String(events[0].id));
    }
  }, [events, eventId]);

  const checkIn = async (rawCode: string) => {
    const clean = rawCode.trim();
    if (!clean || !eventId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/tickets/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: clean, eventId: Number(eventId) }),
      });
      const body = await res.json();
      const entry: ScanResult = res.ok
        ? {
            ok: true,
            message: "Checked in.",
            code: body.data?.code,
            ticketType: body.data?.ticketType,
            holderName: body.data?.holderName,
            holderEmail: body.data?.holderEmail,
            checkedInAt: body.data?.checkedInAt,
            source: body.data?.source,
          }
        : { ok: false, message: body.message || "Invalid ticket" };
      setResult(entry);
      setLog((prev) => [entry, ...prev].slice(0, 12));
      setCode("");
    } catch {
      setResult({ ok: false, message: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  };

  const stopCamera = () => {
    if (scanTimer.current) {
      window.clearInterval(scanTimer.current);
      scanTimer.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
    };
    const w = window as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
    if (!w.BarcodeDetector) {
      setCameraError(
        "This browser cannot scan QR codes. Use manual code entry below."
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new w.BarcodeDetector({ formats: ["qr_code"] });
      scanTimer.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            const value = codes[0].rawValue;
            stopCamera();
            await checkIn(value);
          }
        } catch {
          /* ignore transient decode errors */
        }
      }, 600);
    } catch {
      setCameraError("Camera permission denied. Use manual code entry.");
      stopCamera();
    }
  };

  useEffect(() => () => stopCamera(), []);

  const eventName = useMemo(
    () => events?.find((e) => String(e.id) === eventId)?.title ?? "",
    [events, eventId]
  );

  return (
    <DashboardLayout>
      <Head>
        <title>Check-in — Jojjy Gallery CRM</title>
      </Head>
      <PageHeader
        title="Door check-in"
        subtitle="Scan a QR ticket or type its code. Each ticket checks in once."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <Field label="Event" required>
            <Select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              <option value="">Select an event…</option>
              {events?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · {new Date(e.startsAt).toLocaleDateString()}
                </option>
              ))}
            </Select>
          </Field>
          {eventsError && <Alert tone="danger">Could not load events.</Alert>}

          <div>
            {cameraOn ? (
              <div className="space-y-3">
                <video
                  ref={videoRef}
                  className="aspect-video w-full rounded-2xl bg-black"
                  muted
                  playsInline
                />
                <Button variant="secondary" onClick={stopCamera}>
                  Stop camera
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={startCamera} disabled={!eventId}>
                Start camera scan
              </Button>
            )}
            {cameraError && (
              <p className="mt-2 text-xs text-ink-500">{cameraError}</p>
            )}
          </div>

          <Field
            label="Ticket code (manual fallback)"
            required
            hint="Also works for accessible manual entry."
          >
            <div className="flex items-stretch gap-2">
              <TextField
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void checkIn(code);
                }}
                placeholder="e.g. 1A2B3C4D5E"
                autoComplete="off"
              />
              <Button
                onClick={() => checkIn(code)}
                disabled={busy || !code.trim() || !eventId}
                className="shrink-0 whitespace-nowrap"
              >
                {busy ? "…" : "Check in"}
              </Button>
            </div>
          </Field>

          {result && (
            <Alert
              tone={result.ok ? "success" : "danger"}
              title={result.ok ? "Checked in" : "Not admitted"}
            >
              {result.ok ? (
                <div className="space-y-1">
                  <p>
                    <span className="font-mono">{result.code}</span> ·{" "}
                    {result.ticketType}
                    {result.source === "COMPLIMENTARY" ? " · complimentary" : ""}
                  </p>
                  {result.holderName && (
                    <p>
                      {result.holderName}
                      {result.holderEmail ? ` · ${result.holderEmail}` : ""}
                    </p>
                  )}
                  {result.checkedInAt && (
                    <p>at {new Date(result.checkedInAt).toLocaleTimeString()}</p>
                  )}
                </div>
              ) : (
                result.message
              )}
            </Alert>
          )}
        </Card>

        <Card>
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-ink-500">
            Recent scans {eventName ? `· ${eventName}` : ""}
          </p>
          {log.length === 0 ? (
            <p className="text-sm text-ink-500">No scans yet this session.</p>
          ) : (
            <ul className="divide-y divide-ink-100">
              {log.map((entry, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-ink-700">
                    {entry.ok
                      ? `${entry.code} · ${entry.holderName ?? "Guest"}`
                      : entry.message}
                  </span>
                  <StatusBadge tone={entry.ok ? "success" : "danger"}>
                    {entry.ok ? "In" : "Rejected"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
          {canCorrect && (
            <p className="mt-4 text-xs text-ink-500">
              Corrections are made from the Attendees list on the Tickets page,
              which records who corrected a check-in and why.
            </p>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
