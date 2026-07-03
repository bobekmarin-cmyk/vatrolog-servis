import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import type { SubscriptionPlan } from "@prisma/client";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;
  const body = (await req.json()) as {
    activeUntil?: string | null;
    blocked?: boolean;
    plan?: string;
  };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, blocked: true, activeUntil: true, plan: true },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });

  const data: { activeUntil?: Date | null; blocked?: boolean; plan?: SubscriptionPlan } = {};

  if (body.activeUntil !== undefined) {
    data.activeUntil = body.activeUntil ? new Date(body.activeUntil) : null;
  }
  if (typeof body.blocked === "boolean") {
    data.blocked = body.blocked;
  }
  if (typeof body.plan === "string") {
    if (!["START", "STANDARD", "PREMIUM"].includes(body.plan)) {
      return NextResponse.json({ error: "Nepoznat plan." }, { status: 400 });
    }
    data.plan = body.plan as SubscriptionPlan;
  }

  // Detektiraj prijelaze koji bi morali force-logout sve tenant sesije:
  //  - blocked: false → true
  //  - activeUntil pomaknut u prošlost (subscription istekla)
  // Inače JWT-ovi koji nose stari `blocked: false` / pre-expired `activeUntilTs`
  // ostaju važeći do isteka (30 dana) i middleware ih i dalje propušta.
  const now = new Date();
  const becomingBlocked =
    typeof body.blocked === "boolean" && body.blocked === true && company.blocked === false;
  const becomingExpired =
    "activeUntil" in data &&
    data.activeUntil !== undefined &&
    data.activeUntil !== null &&
    data.activeUntil.getTime() < now.getTime() &&
    (!company.activeUntil || company.activeUntil.getTime() >= now.getTime());

  const planChanged = data.plan !== undefined && data.plan !== company.plan;

  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: companyId }, data });
    if (planChanged) {
      await tx.auditLog.create({
        data: {
          companyId,
          actorType: "PLATFORM",
          action: "platform.subscription.plan_change",
          entity: "Company",
          entityId: companyId,
          meta: { from: company.plan, to: data.plan },
        },
      });
    }
    if (becomingBlocked || becomingExpired) {
      const cutoff = new Date();
      await tx.accountUser.updateMany({
        where: { companyId },
        data: { sessionsValidAfter: cutoff, currentSessionId: null },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          actorType: "PLATFORM",
          action: becomingBlocked
            ? "platform.subscription.block"
            : "platform.subscription.expire",
          entity: "Company",
          entityId: companyId,
          meta: {
            cutoff: cutoff.toISOString(),
            reason: becomingBlocked ? "blocked=true" : "activeUntil pomjeren u prošlost",
          },
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
