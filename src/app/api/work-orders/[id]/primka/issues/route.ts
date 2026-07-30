import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getPrimkaIssueStatus, issuePrimka } from "@/lib/primkaIssue";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });

  const status = await getPrimkaIssueStatus(id);
  return NextResponse.json({
    ok: true,
    contentKey: status.contentKey,
    canIssueNew: status.canIssueNew,
    issues: status.issues.map((i) => ({
      id: i.id,
      version: i.version,
      issuedAtLabel: i.issuedAtLabel,
      hasPdf: i.hasPdf,
    })),
  });
}

/** Izdaj novu primku (samo ako ima novih podataka). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { id } = await params;
  const order = await prisma.workOrder.findFirst({
    where: { id, companyId: session.companyId },
    select: { id: true },
  });
  if (!order) return NextResponse.json({ error: "Nalog nije pronađen." }, { status: 404 });

  const before = await getPrimkaIssueStatus(id);
  if (!before.canIssueNew) {
    return NextResponse.json(
      {
        error: "Primka za trenutne količine je već izdana. Otvori postojeću ili dodaj nove aparate/količinu.",
        reason: "already_current",
        latestIssueId: before.latest?.id ?? null,
      },
      { status: 409 },
    );
  }

  try {
    const issued = await issuePrimka(id);
    return NextResponse.json({
      ok: true,
      created: issued.created,
      issueId: issued.issueId,
      version: issued.version,
      filename: issued.filename,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    return NextResponse.json(
      { error: msg === "BUILD_FAILED" ? "Generiranje primke nije uspjelo." : "Greška pri izdavanju." },
      { status: 500 },
    );
  }
}
