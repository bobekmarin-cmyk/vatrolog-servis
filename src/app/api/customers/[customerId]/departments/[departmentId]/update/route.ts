import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

import { redirectRelative } from "@/lib/httpRedirect";
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ customerId: string; departmentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { customerId, departmentId } = await params;
  if (!customerId || !departmentId) return badRequest("Nedostaje ID.");

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const contactPerson = String(form.get("contactPerson") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();

  if (!name) return badRequest("Naziv odjela je obavezan.");

  const dept = await prisma.customerDepartment.findFirst({
    where: {
      id: departmentId,
      customerId,
      companyId: session.companyId,
    },
    select: { id: true },
  });
  if (!dept) return NextResponse.json({ error: "Odjel ne postoji." }, { status: 404 });

  try {
    await prisma.customerDepartment.update({
      where: { id: departmentId },
      data: {
        name,
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
      },
    });

    return redirectRelative(`/customers/${customerId}`, 303);
  } catch {
    return NextResponse.json({ error: "Greška kod spremanja odjeljenja." }, { status: 400 });
  }
}

