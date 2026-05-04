import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

import { redirectRelative } from "@/lib/httpRedirect";
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return badRequest("Naziv proizvođača je obavezan.");

  const displayName = String(form.get("displayName") ?? "").trim() || null;
  const oib = String(form.get("oib") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim() || null;
  const contactPerson = String(form.get("contactPerson") ?? "").trim() || null;
  const contactEmail = String(form.get("contactEmail") ?? "").trim() || null;

  try {
    const manufacturer = await prisma.manufacturer.create({
      data: { name, displayName, oib, address, contactPerson, contactEmail },
    });
    await prisma.serviceLabel.createMany({
      data: [
        { manufacturerId: manufacturer.id, kind: "PERIODIC" },
        { manufacturerId: manufacturer.id, kind: "APPARATUS_MASS" },
        { manufacturerId: manufacturer.id, kind: "CYLINDER_MASS" },
      ],
      skipDuplicates: true,
    });
    return redirectRelative("/platform/manufacturers", 303);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Proizvođač s tim nazivom već postoji." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška kod spremanja proizvođača." }, { status: 500 });
  }
}
