import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> }
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return badRequest("Naziv proizvođača je obavezan.");

  const displayName = String(form.get("displayName") ?? "").trim() || null;
  const oib = String(form.get("oib") ?? "").trim() || null;
  const address = String(form.get("address") ?? "").trim() || null;
  const contactPerson = String(form.get("contactPerson") ?? "").trim() || null;
  const contactEmail = String(form.get("contactEmail") ?? "").trim() || null;

  const existing = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "Proizvođač nije pronađen." }, { status: 404 });

  try {
    await prisma.manufacturer.update({
      where: { id: manufacturerId },
      data: {
        name,
        displayName,
        oib,
        address,
        contactPerson,
        contactEmail,
      },
    });
    return NextResponse.redirect(
      new URL(`/platform/manufacturers/${manufacturerId}`, req.url),
      303,
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "Proizvođač s tim nazivom već postoji." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška kod spremanja." }, { status: 500 });
  }
}
