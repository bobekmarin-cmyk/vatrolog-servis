import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";
import { logInfo, logWarn } from "@/lib/logger";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = await req.json();
  const servicerId = String(body.servicerId ?? "");
  const pin = String(body.pin ?? "");

  if (!servicerId || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "Potreban je ID servisera i 4-znamenkasti PIN." }, { status: 400 });
  }

  // Rate limit po kombinaciji IP + servicer (10 pokušaja u 10 min)
  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("pinActivate", `${ipKey}:${servicerId}`, { limit: 10, windowSec: 600 });
  if (rl.blocked) {
    logWarn("pin_activate_rate_limited", { companyId: session.companyId, servicerId, ipKey });
    return NextResponse.json(
      { error: `Previše pokušaja. Pričekaj ${rl.retryAfterSec} s.` },
      { status: 429 }
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: servicerId, companyId: session.companyId, active: true, role: "SERVISER" },
  });

  if (!user) return NextResponse.json({ error: "Serviser nije pronađen." }, { status: 404 });
  if (!user.pin) return NextResponse.json({ error: "Serviser nema postavljen PIN. Admin ga mora postaviti." }, { status: 400 });

  const valid = await bcrypt.compare(pin, user.pin);
  if (!valid) {
    logWarn("pin_activate_invalid", { companyId: session.companyId, servicerId, ipKey });
    return NextResponse.json({ error: "Neispravan PIN." }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: servicerId },
    data: { activatedAt: new Date() },
  });

  logInfo("pin_activate_success", { companyId: session.companyId, servicerId });
  return NextResponse.json({ ok: true, name: user.fullName });
}
