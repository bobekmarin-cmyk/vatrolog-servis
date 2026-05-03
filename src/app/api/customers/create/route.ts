// src/app/api/customers/create/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit, extractAuditMeta } from "@/lib/auditLog";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  const shortNameRaw = String(form.get("shortName") ?? "").trim();
  const oib = String(form.get("oib") ?? "").trim();
  const street = String(form.get("street") ?? "").trim();
  const postalCode = String(form.get("postalCode") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const address = [street, [postalCode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ").trim();
  const contactPerson = String(form.get("contactPerson") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const autoNotify = form.get("autoNotify") === "on" || form.get("autoNotify") === "true";
  const from = String(form.get("from") ?? "").trim();

  const deptNames = (form.getAll("deptName") as unknown[]).map((x) => String(x ?? "").trim());
  const deptContactPeople = (form.getAll("deptContactPerson") as unknown[]).map((x) => String(x ?? "").trim());
  const deptPhones = (form.getAll("deptPhone") as unknown[]).map((x) => String(x ?? "").trim());
  const deptEmails = (form.getAll("deptEmail") as unknown[]).map((x) => String(x ?? "").trim());

  if (!name || !oib || !street || !city) {
    return NextResponse.json(
      { error: "Nedostaju obavezna polja (naziv, OIB, ulica i broj, grad)." },
      { status: 400 }
    );
  }

  try {
    let createdId = "";
    await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: {
          companyId: session.companyId,
          type: "LEGAL",
          name,
          shortName: shortNameRaw || null,
          oib,
          street,
          postalCode: postalCode || null,
          city,
          address,
          contactPerson: contactPerson || null,
          phone: phone || null,
          email: email || null,
          autoNotify,
        },
        select: { id: true },
      });
      createdId = c.id;

      const rows = deptNames
        .map((dn, idx) => ({
          name: dn,
          contactPerson: deptContactPeople[idx] ?? "",
          phone: deptPhones[idx] ?? "",
          email: deptEmails[idx] ?? "",
        }))
        .filter((r) => r.name.trim().length > 0);

      if (rows.length > 0) {
        await tx.customerDepartment.createMany({
          data: rows.map((r) => ({
            companyId: session.companyId,
            customerId: c.id,
            name: r.name,
            contactPerson: r.contactPerson.trim() ? r.contactPerson.trim() : null,
            phone: r.phone.trim() ? r.phone.trim() : null,
            email: r.email.trim() ? r.email.trim() : null,
          })),
          skipDuplicates: true,
        });
      }

    });

    const audit = extractAuditMeta(req);
    await logAudit({
      companyId: session.companyId,
      actorId: session.accountUserId,
      actorType: "ACCOUNT_USER",
      action: "customer.create",
      entity: "Customer",
      entityId: createdId,
      meta: { name, oib },
      ip: audit.ip,
      userAgent: audit.userAgent,
    });

    if (from === "work-order-new") {
      const url = new URL("/work-orders/new", req.url);
      url.searchParams.set("customerId", createdId);
      url.searchParams.set("created", "1");
      return NextResponse.redirect(url, 303);
    }

    const successUrl = new URL("/customers", req.url);
    successUrl.searchParams.set("created", "1");
    return NextResponse.redirect(successUrl, 303);
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Kupac s tim OIB-om već postoji u tvrtki." }, { status: 409 });
    }
    return NextResponse.json({ error: "Greška kod kreiranja kupca." }, { status: 400 });
  }
}
