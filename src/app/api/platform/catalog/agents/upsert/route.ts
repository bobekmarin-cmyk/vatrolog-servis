import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const body = (await req.json()) as {
    id?: string;
    code?: string;
    label?: string;
    symbol?: string | null;
    sortOrder?: number;
  };

  const code = String(body.code ?? "").trim().toUpperCase();
  const label = String(body.label ?? "").trim();
  const symbol = body.symbol === undefined ? undefined : (body.symbol?.toString().trim() || null);
  const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

  if (!code || !/^[A-Z0-9_]+$/.test(code)) {
    return NextResponse.json({ error: "Code mora biti slova/brojevi/podvlake (npr. PRAH, F500)." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "Label je obavezan." }, { status: 400 });
  }

  try {
    if (body.id) {
      const updated = await prisma.agentType.update({
        where: { id: body.id },
        data: { code, label, symbol, sortOrder },
      });
      return NextResponse.json({ ok: true, agent: updated });
    }
    const created = await prisma.agentType.create({
      data: { code, label, symbol: symbol ?? null, sortOrder },
    });
    return NextResponse.json({ ok: true, agent: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Sredstvo s tim code-om već postoji." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška pri spremanju." }, { status: 500 });
  }
}
