import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function redirectWithError(req: Request, customerId: string, msg: string) {
  const url = new URL(`/customers/${customerId}`, req.url);
  url.searchParams.set("error", msg);
  return NextResponse.redirect(url, 303);
}

function redirectWithSuccess(req: Request, customerId: string) {
  const url = new URL(`/customers/${customerId}`, req.url);
  url.searchParams.set("success", "1");
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { customerId } = await params;
  if (!customerId) return NextResponse.json({ error: "Nedostaje customerId." }, { status: 400 });

  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  const shortNameRaw = String(form.get("shortName") ?? "").trim();
  const street = String(form.get("street") ?? "").trim();
  const postalCode = String(form.get("postalCode") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ").trim();
  const contactPerson = String(form.get("contactPerson") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  const autoNotify = form.get("autoNotify") === "on" || form.get("autoNotify") === "true";

  function parsePct(field: string): number | null | undefined {
    const raw = String(form.get(field) ?? "").trim().replace(",", ".");
    if (raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
    return n;
  }
  const discountServicesPct = parsePct("discountServicesPct");
  const discountLabelsPct = parsePct("discountLabelsPct");
  const discountPartsPct = parsePct("discountPartsPct");
  if (discountServicesPct === undefined || discountLabelsPct === undefined || discountPartsPct === undefined) {
    return redirectWithError(req, customerId, "Rabat mora biti broj između 0 i 100.");
  }

  if (!name || !street || !city) {
    return redirectWithError(req, customerId, "Nedostaju obavezna polja (naziv, ulica i broj, grad).");
  }

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!existing) return redirectWithError(req, customerId, "Kupac ne postoji.");

  try {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        type: "LEGAL",
        name,
        shortName: shortNameRaw || null,
        street,
        postalCode: postalCode || null,
        city,
        address,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        note: note || null,
        autoNotify,
        discountServicesPct,
        discountLabelsPct,
        discountPartsPct,
      },
    });

    return redirectWithSuccess(req, customerId);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return redirectWithError(req, customerId, "Kupac s tim OIB-om već postoji.");
    }
    return redirectWithError(req, customerId, "Greška kod spremanja kupca.");
  }
}

