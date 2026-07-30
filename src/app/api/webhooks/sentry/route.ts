import { NextResponse } from "next/server";
import { logError, logInfo, logWarn } from "@/lib/logger";
import {
  buildAgentTask,
  hasEnoughSignal,
  parseSentryPayload,
  shouldDispatch,
  verifySentrySignature,
} from "@/lib/sentryWebhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sentry → auto-fix agent.
 *
 * Ruta je pod `/api/webhooks/` pa je izuzeta od CSRF provjere u middlewareu;
 * zaštita je HMAC potpis koji Sentry šalje u `sentry-hook-signature`.
 *
 * Zašto ovako, a ne Sentryjevom akcijom „Create a GitHub issue": ta je akcija
 * dostupna tek na Business planu. Ovaj most radi na svakom planu.
 */

const WORKFLOW_FILE = "auto-fix.yml";

function repoSlug(): string {
  return process.env.GITHUB_REPO?.trim() || "bobekmarin-cmyk/vatrolog-servis";
}

/** Token treba dozvolu Actions: Read and write (isti kao za ručni backup). */
function githubToken(): string | null {
  return (
    process.env.GITHUB_AUTOMATION_TOKEN?.trim() ||
    process.env.GITHUB_BACKUP_TOKEN?.trim() ||
    null
  );
}

async function dispatchAgent(task: string): Promise<{ ok: boolean; detail?: string }> {
  const token = githubToken();
  if (!token) return { ok: false, detail: "GITHUB_AUTOMATION_TOKEN/GITHUB_BACKUP_TOKEN nije postavljen." };

  const res = await fetch(
    `https://api.github.com/repos/${repoSlug()}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      // `task` je jedini input workflowa; GitHub ga ogranicava na 65k znakova.
      body: JSON.stringify({ ref: "main", inputs: { task: task.slice(0, 60000) } }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { ok: false, detail: `GitHub ${res.status}: ${detail.slice(0, 200)}` };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const secret = process.env.SENTRY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    logWarn("sentry_webhook_not_configured");
    return NextResponse.json({ error: "Webhook nije konfiguriran." }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature =
    req.headers.get("sentry-hook-signature") ?? req.headers.get("Sentry-Hook-Signature");

  if (!verifySentrySignature(rawBody, signature, secret)) {
    logWarn("sentry_webhook_bad_signature");
    return NextResponse.json({ error: "Neispravan potpis." }, { status: 401 });
  }

  const resource = req.headers.get("sentry-hook-resource");

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Neispravan JSON." }, { status: 400 });
  }

  // Sentry pri instalaciji integracije šalje `installation` događaj — potvrdimo ga i stanemo.
  if (resource === "installation") {
    return NextResponse.json({ ok: true, ignored: "installation" });
  }

  const issue = parseSentryPayload(payload);
  if (!issue) {
    return NextResponse.json({ ok: true, ignored: "nepoznat format" });
  }

  if (!hasEnoughSignal(issue)) {
    logInfo("sentry_webhook_insufficient_signal", { title: issue.title });
    return NextResponse.json({
      ok: true,
      ignored: "premalo podataka za agenta (testna obavijest?)",
    });
  }

  if (!shouldDispatch(issue.issueId)) {
    logInfo("sentry_webhook_duplicate", { issueId: issue.issueId });
    return NextResponse.json({ ok: true, ignored: "duplikat" });
  }

  try {
    const result = await dispatchAgent(buildAgentTask(issue));
    if (!result.ok) {
      logError("sentry_webhook_dispatch_failed", new Error(result.detail ?? "nepoznato"), {
        issueId: issue.issueId,
      });
      // 200 namjerno: Sentry ne treba retryati ako je problem na nasoj strani.
      return NextResponse.json({ ok: false, error: result.detail }, { status: 200 });
    }

    logInfo("sentry_webhook_agent_dispatched", {
      issueId: issue.issueId,
      title: issue.title,
    });
    return NextResponse.json({ ok: true, dispatched: true });
  } catch (err) {
    logError("sentry_webhook_failed", err, { issueId: issue.issueId });
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
