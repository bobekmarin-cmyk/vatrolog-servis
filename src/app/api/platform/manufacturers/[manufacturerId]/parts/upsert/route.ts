import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { PartUnit } from "@prisma/client";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function parseUnit(value: unknown): PartUnit {
  if (value === "KG" || value === "L" || value === "KOM") return value;
  return PartUnit.KOM;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;
  const body = (await req.json()) as {
    id?: string;
    code?: string;
    name?: string;
    common?: boolean;
    unit?: string;
    typeIds?: string[];
  };

  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const common = !!body.common;
  const unit = parseUnit(body.unit);
  const typeIds = Array.isArray(body.typeIds) ? body.typeIds.filter((x) => !!x) : [];

  if (!code) return badRequest("Šifra je obavezna.");
  if (!name) return badRequest("Naziv je obavezan.");
  if (typeIds.length === 0) return badRequest("Odaberi barem jedan tip aparata.");

  // validiraj da su svi typeId-evi od ovog proizvođača
  const mfLinks = await prisma.manufacturerExtinguisherType.findMany({
    where: { manufacturerId, extinguisherTypeId: { in: typeIds } },
    select: { extinguisherTypeId: true },
  });
  const validIds = new Set(mfLinks.map((x) => x.extinguisherTypeId));
  const invalid = typeIds.filter((id) => !validIds.has(id));
  if (invalid.length > 0) {
    return badRequest("Neki odabrani tipovi ne pripadaju ovom proizvođaču.");
  }

  try {
    if (body.id) {
      // update part
      const existing = await prisma.part.findUnique({
        where: { id: body.id },
        select: { id: true, manufacturerId: true, companyId: true },
      });
      if (!existing || existing.manufacturerId !== manufacturerId || existing.companyId !== null) {
        return NextResponse.json({ error: "Dio ne pripada globalnom katalogu ovog proizvođača." }, { status: 404 });
      }

      await prisma.$transaction([
        prisma.part.update({
          where: { id: body.id },
          data: { code, name, common, unit },
        }),
        prisma.partExtinguisherType.deleteMany({ where: { partId: body.id } }),
        prisma.partExtinguisherType.createMany({
          data: typeIds.map((tid) => ({ partId: body.id!, extinguisherTypeId: tid })),
        }),
      ]);

      return NextResponse.json({ ok: true, id: body.id });
    }

    // create
    const created = await prisma.part.create({
      data: {
        manufacturerId,
        code,
        name,
        common,
        unit,
        active: true,
        types: {
          create: typeIds.map((tid) => ({ extinguisherTypeId: tid })),
        },
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Dio s tom šifrom već postoji za ovog proizvođača." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Greška pri spremanju dijela." }, { status: 500 });
  }
}
