import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platformAuth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rucno pokretanje backupa baze s platform sucelja.
 *
 * Backup namjerno i dalje radi GitHub Actions workflow (`backup-db.yml`), a ne
 * aplikacija: tamo su pg_dump odgovarajuce verzije, kljuc za enkripciju i S3
 * pristup. Ova ruta samo okine `workflow_dispatch` i vrati status zadnjih runova.
 */

const WORKFLOW_FILE = "backup-db.yml";

function repoSlug(): string {
  return process.env.GITHUB_REPO?.trim() || "bobekmarin-cmyk/vatrolog-servis";
}

function token(): string | null {
  return process.env.GITHUB_BACKUP_TOKEN?.trim() || null;
}

const MISSING_TOKEN_MESSAGE =
  "GITHUB_BACKUP_TOKEN nije postavljen. Dodaj fine-grained GitHub token s dozvolom " +
  "Actions: Read and write u Railway varijable, ili pokreni workflow rucno na GitHubu.";

type WorkflowRun = {
  id: number;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  event: string;
};

async function fetchRuns(limit: number): Promise<WorkflowRun[]> {
  const t = token();
  if (!t) return [];
  const res = await fetch(
    `https://api.github.com/repos/${repoSlug()}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=${limit}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${t}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { workflow_runs?: WorkflowRun[] };
  return data.workflow_runs ?? [];
}

function serialize(r: WorkflowRun) {
  return {
    id: r.id,
    status: r.status,
    conclusion: r.conclusion,
    createdAt: r.created_at,
    url: r.html_url,
    event: r.event,
  };
}

/** Status zadnjih pokretanja backupa. */
export async function GET() {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  if (!token()) {
    return NextResponse.json({
      ok: true,
      configured: false,
      message: MISSING_TOKEN_MESSAGE,
      runs: [],
    });
  }

  const runs = await fetchRuns(5);
  return NextResponse.json({ ok: true, configured: true, runs: runs.map(serialize) });
}

/** Pokreni backup sada. */
export async function POST(req: Request) {
  const session = await getPlatformSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const t = token();
  if (!t) {
    return NextResponse.json({ error: MISSING_TOKEN_MESSAGE }, { status: 400 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${repoSlug()}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${t}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 403 || res.status === 404
        ? " Provjeri da token ima dozvolu Actions: Read and write na ovom repozitoriju."
        : "";
    return NextResponse.json(
      { error: `GitHub je odbio zahtjev (${res.status}).${hint} ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  const audit = extractAuditMeta(req);
  await logAudit({
    actorType: "PLATFORM_USER",
    actorId: session.platformUserId,
    action: "platform.backup.manualRun",
    entity: "Backup",
    ip: audit.ip,
    userAgent: audit.userAgent,
  });

  // GitHub-u treba trenutak da run postane vidljiv u API-ju.
  await new Promise((r) => setTimeout(r, 1500));
  const runs = await fetchRuns(3);

  return NextResponse.json({
    ok: true,
    message: "Backup je pokrenut. Traje otprilike minutu.",
    runs: runs.map(serialize),
  });
}
