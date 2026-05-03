import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

type QuickCreateBody = {
  oib?: string;
  name?: string;
  shortName?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
};

function normalizeOib(value: string) {
  return value.replace(/\D/g, "");
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as QuickCreateBody | null;
  if (!body) return NextResponse.json({ error: "Neispravan payload." }, { status: 400 });

  const oib = normalizeOib(String(body.oib ?? ""));
  const name = String(body.name ?? "").trim();
  const shortName = String(body.shortName ?? "").trim();
  const street = String(body.street ?? "").trim();
  const postalCode = String(body.postalCode ?? "").trim();
  const city = String(body.city ?? "").trim();
  const contactPerson = String(body.contactPerson ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!/^\d{11}$/.test(oib)) {
    return NextResponse.json({ error: "OIB mora imati točno 11 znamenki." }, { status: 400 });
  }
  if (!name || !street || !city) {
    return NextResponse.json({ error: "Obavezno: naziv, ulica i broj, grad." }, { status: 400 });
  }

  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ").trim();

  try {
    const customer = await prisma.customer.create({
      data: {
        companyId: session.companyId,
        type: "LEGAL",
        name,
        shortName: shortName || null,
        oib,
        street,
        postalCode: postalCode || null,
        city,
        address,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        oib: true,
        address: true,
        contactPerson: true,
        phone: true,
      },
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Kupac s tim OIB-om već postoji." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška kod brzog kreiranja kupca." }, { status: 500 });
  }
}

