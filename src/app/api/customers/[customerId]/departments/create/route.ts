import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

import { redirectRelative } from "@/lib/httpRedirect";
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(req: Request, { params }: { params: Promise<{ customerId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { customerId } = await params;
  if (!customerId) return badRequest("Nedostaje customerId.");

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const contactPerson = String(form.get("contactPerson") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!name) return badRequest("Naziv odjela je obavezan.");

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { id: true },
  });
  if (!customer) return NextResponse.json({ error: "Kupac ne postoji." }, { status: 404 });

  try {
    await prisma.customerDepartment.create({
      data: {
        companyId: session.companyId,
        customerId,
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
      },
    });

    return redirectRelative(`/customers/${customerId}`, 303);
  } catch {
    return NextResponse.json({ error: "Greška kod kreiranja odjeljenja." }, { status: 400 });
  }
}

