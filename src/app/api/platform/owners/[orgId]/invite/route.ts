import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { generateToken } from "@/lib/authTokens";
import { ownerPortalInviteEmail, sendSystemMail } from "@/lib/systemMail";
import { normalizeOwnerEmail } from "@/lib/ownerAuth";
import { getAppBaseUrl } from "@/lib/appVersion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 14;

/**
 * Vendor šalje pozivnicu za korisnički portal (novi ili dodatni račun vlasnika).
 * Pozivnica je vezana uz OwnerOrg (po OIB-u), ne mijenja postojeće veze servisa.
 * Body: { email: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { orgId } = await params;
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normalizeOwnerEmail(body.email ?? "");
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Unesite ispravnu e-mail adresu." }, { status: 400 });
  }

  const org = await prisma.ownerOrg.findUnique({ where: { id: orgId }, select: { oib: true, name: true } });
  if (!org) return NextResponse.json({ error: "Vlasnik ne postoji." }, { status: 404 });

  const existingOwner = await prisma.owner.findUnique({ where: { email }, select: { id: true } });

  const { plaintext, hash } = generateToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  await prisma.$transaction([
    prisma.authToken.updateMany({
      where: {
        type: "OWNER_INVITE",
        usedAt: null,
        email,
        meta: { path: ["ownerOrgId"], equals: orgId },
      },
      data: { usedAt: new Date() },
    }),
    prisma.authToken.create({
      data: {
        type: "OWNER_INVITE",
        tokenHash: hash,
        email,
        ownerId: existingOwner?.id ?? null,
        expiresAt,
        meta: { ownerOrgId: orgId },
      },
    }),
  ]);

  const acceptUrl = `${getAppBaseUrl()}/korisnik/invite/${encodeURIComponent(plaintext)}`;
  const tpl = await ownerPortalInviteEmail({
    servicerName: "VatroLog",
    customerName: org.name ?? org.oib,
    acceptUrl,
  });
  const sent = await sendSystemMail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    kind: "OWNER_PORTAL_INVITE",
  });
  if (!sent.ok) {
    return NextResponse.json({ error: `Slanje e-maila nije uspjelo: ${sent.error}` }, { status: 500 });
  }

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.owner.invite",
      entity: "OwnerOrg",
      entityId: orgId,
      meta: { by: ps.platformUserId, email },
    },
  });

  return NextResponse.json({ ok: true, email });
}
