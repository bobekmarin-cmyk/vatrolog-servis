import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/gmail";
import { encryptSecret, testERacuniConnection, ERacuniError } from "@/lib/eracuni";
import { logAudit } from "@/lib/auditLog";
import { companyPlanAllows, planUpgradeMessage } from "@/lib/subscriptionPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  enabled?: unknown;
  apiUsername?: unknown;
  apiPassword?: unknown;
  apiToken?: unknown;
  paymentMethod?: unknown;
  paymentDueDays?: unknown;
  labelKompletCode?: unknown;
  labelKompletName?: unknown;
  labelKompletPrice?: unknown;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await companyPlanAllows(session.companyId, "INVOICING_INTEGRATIONS"))) {
    return NextResponse.json({ error: planUpgradeMessage("INVOICING_INTEGRATIONS") }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Neispravan JSON" }, { status: 400 });
  }

  const enabled = body.enabled === true;
  const apiUsername = str(body.apiUsername);
  const apiPassword = str(body.apiPassword);
  const apiToken = str(body.apiToken);
  const paymentMethod = str(body.paymentMethod) || "bankTransfer";
  const dueDaysRaw = Number(body.paymentDueDays);
  const paymentDueDays = Number.isInteger(dueDaysRaw) && dueDaysRaw >= 0 && dueDaysRaw <= 365 ? dueDaysRaw : 15;
  const labelKompletCode = str(body.labelKompletCode) || null;
  const labelKompletName = str(body.labelKompletName) || "Komplet naljepnica";
  const priceRaw = body.labelKompletPrice;
  const priceNum = priceRaw === "" || priceRaw === null || priceRaw === undefined ? null : Number(priceRaw);
  if (priceNum !== null && (!Number.isFinite(priceNum) || priceNum < 0)) {
    return NextResponse.json({ error: "Neispravna cijena kompleta naljepnica." }, { status: 400 });
  }

  const existing = await prisma.companyERacuniSettings.findUnique({
    where: { companyId: session.companyId },
  });

  // Prazna lozinka/token pri editiranju = zadrži postojeće.
  let effectivePassword = apiPassword;
  let effectiveToken = apiToken;
  if (!effectivePassword && existing?.apiPasswordEnc) {
    try {
      effectivePassword = decryptToken(existing.apiPasswordEnc);
    } catch {
      effectivePassword = "";
    }
  }
  if (!effectiveToken && existing?.apiTokenEnc) {
    try {
      effectiveToken = decryptToken(existing.apiTokenEnc);
    } catch {
      effectiveToken = "";
    }
  }

  if (enabled) {
    if (!apiUsername || !effectivePassword || !effectiveToken) {
      return NextResponse.json(
        { error: "Za aktivaciju su obavezni API korisničko ime, API lozinka i token organizacije." },
        { status: 400 },
      );
    }

    try {
      await testERacuniConnection({
        username: apiUsername,
        secretKey: effectivePassword,
        token: effectiveToken,
      });
    } catch (e) {
      const detail = e instanceof ERacuniError ? e.message : "Nepoznata greška.";
      return NextResponse.json(
        { error: `Spajanje na e-računi nije uspjelo: ${detail}` },
        { status: 400 },
      );
    }
  }

  const data = {
    enabled,
    apiUsername: apiUsername || null,
    apiPasswordEnc: effectivePassword ? encryptSecret(effectivePassword) : null,
    apiTokenEnc: effectiveToken ? encryptSecret(effectiveToken) : null,
    paymentMethod,
    paymentDueDays,
    labelKompletCode,
    labelKompletName,
    labelKompletPrice: priceNum,
    ...(enabled ? { lastTestOkAt: new Date() } : {}),
  };

  await prisma.companyERacuniSettings.upsert({
    where: { companyId: session.companyId },
    create: { companyId: session.companyId, ...data },
    update: data,
  });

  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "eracuni.settings.save",
    entity: "CompanyERacuniSettings",
    meta: { enabled },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.companyERacuniSettings.updateMany({
    where: { companyId: session.companyId },
    data: { enabled: false, apiUsername: null, apiPasswordEnc: null, apiTokenEnc: null, lastTestOkAt: null },
  });

  await logAudit({
    companyId: session.companyId,
    actorId: session.accountUserId,
    actorType: "ACCOUNT_USER",
    action: "eracuni.settings.disconnect",
    entity: "CompanyERacuniSettings",
  });

  return NextResponse.json({ ok: true });
}
