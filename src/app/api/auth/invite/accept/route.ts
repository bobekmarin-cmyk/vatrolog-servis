import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/authTokens";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 10;

type WorkshopPayload = { accountUserId: string; password: string };

export async function POST(req: Request) {
  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("acceptInvite", ipKey, { limit: 12, windowSec: 900 });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
    workshops?: WorkshopPayload[];
  };
  const token = String(body.token ?? "");
  const password = String(body.password ?? "");
  const workshops = Array.isArray(body.workshops) ? body.workshops : [];

  if (!token) return NextResponse.json({ error: "Nedostaje token." }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { error: `Admin lozinka mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.` },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(token);
  const record = await prisma.authToken.findFirst({
    where: {
      tokenHash,
      type: "ACCOUNT_INVITE",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      accountUser: true,
    },
  });
  if (!record?.accountUserId || !record.accountUser) {
    return NextResponse.json({ error: "Pozivnica je neispravna ili je istekla." }, { status: 400 });
  }
  if (record.accountUser.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Pozivnica je dostupna samo za admin račun." },
      { status: 400 },
    );
  }
  if (!record.companyId) {
    return NextResponse.json({ error: "Pozivnica nije vezana uz tvrtku." }, { status: 400 });
  }

  const validatedWorkshops: { accountUserId: string; passwordHash: string }[] = [];
  if (workshops.length > 0) {
    const ids = Array.from(new Set(workshops.map((w) => String(w.accountUserId ?? ""))))
      .filter((id) => id.length > 0);
    const found = await prisma.accountUser.findMany({
      where: { id: { in: ids }, companyId: record.companyId, role: { not: "ADMIN" } },
      select: { id: true, username: true },
    });
    const foundIds = new Set(found.map((a) => a.id));

    for (const w of workshops) {
      const id = String(w.accountUserId ?? "");
      const pwd = String(w.password ?? "");
      if (!id || !pwd) continue;
      if (!foundIds.has(id)) {
        return NextResponse.json(
          { error: "Jedan od user/workshop računa ne pripada ovoj tvrtki." },
          { status: 400 },
        );
      }
      if (pwd.length < MIN_PASSWORD_LENGTH) {
        const found1 = found.find((a) => a.id === id);
        return NextResponse.json(
          {
            error: `Lozinka za ${found1?.username ?? id} mora imati najmanje ${MIN_PASSWORD_LENGTH} znakova.`,
          },
          { status: 400 },
        );
      }
      validatedWorkshops.push({ accountUserId: id, passwordHash: await bcrypt.hash(pwd, 12) });
    }
  }

  const newAdminHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.accountUser.update({
      where: { id: record.accountUserId! },
      data: {
        passwordHash: newAdminHash,
        active: true,
        emailVerifiedAt: record.accountUser?.emailVerifiedAt ?? new Date(),
      },
    });
    await tx.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await tx.authToken.updateMany({
      where: {
        accountUserId: record.accountUserId!,
        type: "ACCOUNT_INVITE",
        usedAt: null,
        id: { not: record.id },
      },
      data: { usedAt: new Date() },
    });

    for (const w of validatedWorkshops) {
      await tx.accountUser.update({
        where: { id: w.accountUserId },
        data: {
          passwordHash: w.passwordHash,
          active: true,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          companyId: record.companyId,
          actorId: record.accountUserId!,
          actorType: "SELF",
          action: "account.password.bulk-set",
          entity: "AccountUser",
          entityId: w.accountUserId,
          ip: ipKey,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId: record.companyId,
        actorId: record.accountUserId!,
        actorType: "SELF",
        action: "account.invite.accept",
        entity: "AccountUser",
        entityId: record.accountUserId!,
        ip: ipKey,
        meta: { workshopsActivated: validatedWorkshops.length },
      },
    });
  });

  return NextResponse.json({ ok: true, workshopsActivated: validatedWorkshops.length });
}
