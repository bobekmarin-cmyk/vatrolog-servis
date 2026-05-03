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
    prefix?: string | null;
    sortOrder?: number;
  };

  const code = String(body.code ?? "").trim().toUpperCase();
  const label = String(body.label ?? "").trim();
  const prefixRaw = body.prefix === undefined ? undefined : body.prefix?.toString().trim();
  const prefix = prefixRaw === undefined ? undefined : prefixRaw === "" ? null : prefixRaw;
  const sortOrder = Number.isFinite(body.sortOrder) ? Number(body.sortOrder) : 0;

  if (!code || !/^[A-Z0-9_]+$/.test(code)) {
    return NextResponse.json({ error: "Code mora biti slova/brojevi/podvlake." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "Label je obavezan." }, { status: 400 });
  }

  // Prefiks je obavezan jer se koristi kao oznaka u šifrarniku usluga i otpremnici
  // (P9, S6, …). Iznimka: CO2 izvedba — ide kroz agenta, nema zaseban prefix.
  const isCo2Exception = code === "CO2";
  if (!isCo2Exception) {
    if (body.id) {
      // Prilikom update-a: ako je `prefix` izričito poslan, mora biti ne-prazan.
      if (prefix === null) {
        return NextResponse.json(
          {
            error:
              "Prefiks (P, S, …) je obavezan jer se koristi kao oznaka u šifrarniku usluga i otpremnici.",
          },
          { status: 400 },
        );
      }
    } else {
      // Prilikom kreiranja: prefix je obavezno ne-prazan string.
      if (!prefix) {
        return NextResponse.json(
          {
            error:
              "Prefiks (P, S, …) je obavezan jer se koristi kao oznaka u šifrarniku usluga i otpremnici.",
          },
          { status: 400 },
        );
      }
    }
  }

  try {
    if (body.id) {
      const updated = await prisma.construction.update({
        where: { id: body.id },
        data: { code, label, prefix, sortOrder },
      });
      return NextResponse.json({ ok: true, construction: updated });
    }
    const created = await prisma.construction.create({
      data: { code, label, prefix: prefix ?? null, sortOrder },
    });
    return NextResponse.json({ ok: true, construction: created });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Izvedba s tim code-om već postoji." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška pri spremanju." }, { status: 500 });
  }
}
