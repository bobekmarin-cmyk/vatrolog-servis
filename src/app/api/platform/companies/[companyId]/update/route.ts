import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import {
  buildAdminUsername,
  buildLocationUsername,
  isValidUsernameSlug,
  type LocationKind,
} from "@/lib/companyAccountNaming";
import { logAudit } from "@/lib/auditLog";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { companyId } = await params;
  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  const serviceCode = String(form.get("serviceCode") ?? "").trim();
  const usernameSlug = String(form.get("usernameSlug") ?? "").trim().toLowerCase();
  const street = String(form.get("street") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const postalCode = String(form.get("postalCode") ?? "").trim();
  const iban = String(form.get("iban") ?? "").trim();
  const contactName = String(form.get("contactName") ?? "").trim() || null;
  const email = String(form.get("email") ?? "").trim() || null;
  const phone = String(form.get("phone") ?? "").trim() || null;
  const accountEmail = String(form.get("accountEmail") ?? "").trim() || null;

  if (!name || !serviceCode || !usernameSlug || !street || !city || !postalCode || !iban) {
    return NextResponse.json({ error: "Nedostaju obavezni podaci." }, { status: 400 });
  }
  if (!/^\d{2}$/.test(serviceCode)) {
    return NextResponse.json(
      { error: "Šifra servisa mora biti dvoznamenkasti broj (npr. 01, 27, 99)." },
      { status: 400 },
    );
  }
  if (!isValidUsernameSlug(usernameSlug)) {
    return NextResponse.json(
      { error: "Slug mora biti 2–15 znakova (samo a-z i 0-9)." },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { serviceCode: true, usernameSlug: true },
  });
  if (!company) return NextResponse.json({ error: "Tvrtka nije pronađena." }, { status: 404 });

  const slugOrCodeChanged =
    company.serviceCode !== serviceCode || company.usernameSlug !== usernameSlug;

  try {
    const renames: { from: string; to: string }[] = [];

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          name,
          serviceCode,
          usernameSlug,
          street,
          city,
          postalCode,
          iban,
          contactName,
          email,
          phone,
        },
      });

      if (!slugOrCodeChanged && accountEmail === null) {
        // Email se nije postavio + slug/code nepromijenjeni → nema potrebe ići po accountima.
        return;
      }

      const accounts = await tx.accountUser.findMany({
        where: { companyId },
        select: {
          id: true,
          username: true,
          role: true,
          email: true,
          serviceLocationId: true,
          serviceLocation: { select: { kind: true, ordinal: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      for (const acc of accounts) {
        let expected: string | null = null;
        if (acc.role === "ADMIN") {
          expected = buildAdminUsername(serviceCode, usernameSlug);
        } else if (acc.serviceLocation) {
          expected = buildLocationUsername(
            serviceCode,
            usernameSlug,
            acc.serviceLocation.kind as LocationKind,
            acc.serviceLocation.ordinal,
          );
        }

        const data: { username?: string; email?: string | null } = {};
        if (expected && expected !== acc.username) {
          data.username = expected;
          renames.push({ from: acc.username, to: expected });
        }
        if (accountEmail !== null && acc.email !== accountEmail) {
          data.email = accountEmail;
        }
        if (Object.keys(data).length > 0) {
          await tx.accountUser.update({ where: { id: acc.id }, data });
        }
      }
    });

    if (renames.length > 0) {
      await logAudit({
        companyId,
        actorId: ps.platformUserId,
        actorType: "PLATFORM_USER",
        action: "platform.company.rename-slug",
        entity: "Company",
        entityId: companyId,
        meta: {
          fromSlug: company.usernameSlug,
          toSlug: usernameSlug,
          fromServiceCode: company.serviceCode,
          toServiceCode: serviceCode,
          renames,
        },
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Kombinacija šifre/sluga ostvaruje konflikt s postojećim usernameom." },
        { status: 409 },
      );
    }
    console.error("[platform/companies/update] error:", e);
    return NextResponse.json({ error: "Greška pri spremanju." }, { status: 500 });
  }

  return redirectRelative(`/platform/companies/${companyId}`, 303);
}
