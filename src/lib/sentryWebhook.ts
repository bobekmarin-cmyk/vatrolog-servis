/**
 * Most između Sentryja i auto-fix agenta.
 *
 * Sentry naplaćuje akciju „Create a new GitHub issue" (dostupna tek na Business
 * planu), pa umjesto nje koristimo Internal Integration: Sentry pošalje webhook
 * ovamo, a mi pokrenemo GitHub Actions workflow koji vrti agenta.
 *
 * Autentikacija ide preko HMAC potpisa koji Sentry šalje u zaglavlju — ruta je
 * javna (nema cookie sesije), pa je potpis jedina zaštita.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export type SentryIssueSummary = {
  title: string;
  culprit: string | null;
  level: string | null;
  environment: string | null;
  issueUrl: string | null;
  /** Kratki isječak stack tracea, ako ga payload sadrži. */
  stackHint: string | null;
  /** Sentryjev id greške — koristi se za sprječavanje dvostrukog pokretanja. */
  issueId: string | null;
};

/** Sentry potpisuje tijelo zahtjeva HMAC-SHA256 s Client Secretom integracije. */
export function verifySentrySignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Izvuče najkorisniji dio stack tracea — okvire iz naseg koda, ne iz node_modules. */
function extractStackHint(event: Record<string, unknown>): string | null {
  const entries = Array.isArray(event.entries) ? event.entries : [];
  for (const entry of entries) {
    const e = entry as { type?: string; data?: unknown };
    if (e.type !== "exception") continue;
    const data = e.data as { values?: Array<{ stacktrace?: { frames?: Array<Record<string, unknown>> } }> };
    const frames = data?.values?.[0]?.stacktrace?.frames;
    if (!Array.isArray(frames)) continue;

    const relevant = frames
      .filter((f) => {
        const file = typeof f.filename === "string" ? f.filename : "";
        return file && !file.includes("node_modules");
      })
      .slice(-8)
      .map((f) => {
        const file = typeof f.filename === "string" ? f.filename : "?";
        const line = typeof f.lineno === "number" ? f.lineno : "?";
        const fn = typeof f.function === "string" ? f.function : "";
        return `  ${file}:${line}${fn ? ` (${fn})` : ""}`;
      });

    if (relevant.length > 0) return relevant.join("\n");
  }
  return null;
}

/** Podržava i `event_alert` (alert rule) i `issue` resurse. */
export function parseSentryPayload(payload: unknown): SentryIssueSummary | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { data?: Record<string, unknown> };
  const data = root.data ?? {};

  const event = (data.event ?? data.issue ?? {}) as Record<string, unknown>;
  if (!event || typeof event !== "object") return null;

  const metadata = (event.metadata ?? {}) as Record<string, unknown>;

  const title = firstString(
    event.title,
    metadata.value,
    metadata.type,
    event.message,
    "Nepoznata greška",
  )!;

  return {
    title,
    culprit: firstString(event.culprit, event.transaction),
    level: firstString(event.level),
    environment: firstString(event.environment),
    issueUrl: firstString(event.web_url, event.url, event.issue_url),
    stackHint: extractStackHint(event),
    issueId: firstString(event.issue_id, event.groupID, event.id),
  };
}

/** Tekst zadatka koji dobiva agent. */
export function buildAgentTask(issue: SentryIssueSummary): string {
  const lines = [
    "Sentry je prijavio grešku u produkciji.",
    "",
    `Naslov: ${issue.title}`,
  ];
  if (issue.culprit) lines.push(`Mjesto: ${issue.culprit}`);
  if (issue.level) lines.push(`Razina: ${issue.level}`);
  if (issue.environment) lines.push(`Okolina: ${issue.environment}`);
  if (issue.issueUrl) lines.push(`Sentry: ${issue.issueUrl}`);
  if (issue.stackHint) {
    lines.push("", "Stack trace (samo naš kod):", issue.stackHint);
  }
  lines.push(
    "",
    "Pronađi uzrok u repozitoriju i popravi ga. Ako iz ovih podataka ne možeš",
    "pouzdano zaključiti uzrok, ne nagađaj — ostavi kod netaknut i objasni zašto.",
  );
  return lines.join("\n");
}

/**
 * Sprječava da retry istog webhooka pokrene agenta dvaput.
 * Dovoljan je kratki memorijski trag — Sentry retry-a u roku nekoliko minuta.
 */
const recentlyDispatched = new Map<string, number>();
const DEDUPE_TTL_MS = 10 * 60 * 1000;

export function shouldDispatch(issueId: string | null): boolean {
  if (!issueId) return true;
  const now = Date.now();

  for (const [key, at] of recentlyDispatched) {
    if (now - at > DEDUPE_TTL_MS) recentlyDispatched.delete(key);
  }

  if (recentlyDispatched.has(issueId)) return false;
  recentlyDispatched.set(issueId, now);
  return true;
}
