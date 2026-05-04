import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import {
  buildAdminUsername,
  buildLocationLabel,
  buildLocationUsername,
  isValidUsernameSlug,
  type LocationKind,
} from "@/lib/companyAccountNaming";
import crypto from "crypto";

import { redirectRelative } from "@/lib/httpRedirect";
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  const oib = String(form.get("oib") ?? "").trim();
  const serviceCode = String(form.get("serviceCode") ?? "").trim();
  const usernameSlug = String(form.get("usernameSlug") ?? "").trim().toLowerCase();
  const street = String(form.get("street") ?? "").trim();
  const city = String(form.get("city") ?? "").trim();
  const postalCode = String(form.get("postalCode") ?? "").trim();
  const iban = String(form.get("iban") ?? "").trim();

  const accountEmail = String(form.get("accountEmail") ?? "").trim() || null;
  const stationaryCount = clampInt(form.get("stationaryCount"), 0, 5, 1);
  const vehicleCount = clampInt(form.get("vehicleCount"), 0, 20, 0);

  if (!name || !oib || !serviceCode || !usernameSlug || !street || !city || !postalCode || !iban) {
    return badRequest("Nedostaju podaci tvrtke.");
  }
  if (!/^\d{2}$/.test(serviceCode)) {
    return badRequest("Šifra servisa mora biti dvoznamenkasti broj (npr. 01, 27, 99).");
  }
  if (!isValidUsernameSlug(usernameSlug)) {
    return badRequest("Slug mora biti 2–15 znakova (samo a-z i 0-9).");
  }
  if (stationaryCount + vehicleCount === 0) {
    return badRequest("Mora postojati barem jedna servisna lokacija.");
  }

  type LocationSpec = { kind: LocationKind; ordinal: number; label: string };
  const locationSpecs: LocationSpec[] = [];
  for (let i = 1; i <= stationaryCount; i++) {
    const fallback = buildLocationLabel("STATIONARY", i);
    const raw = String(form.get(`locationLabel:STATIONARY:${i}`) ?? "").trim();
    locationSpecs.push({ kind: "STATIONARY", ordinal: i, label: raw || fallback });
  }
  for (let i = 1; i <= vehicleCount; i++) {
    const fallback = buildLocationLabel("VEHICLE", i);
    const raw = String(form.get(`locationLabel:VEHICLE:${i}`) ?? "").trim();
    locationSpecs.push({ kind: "VEHICLE", ordinal: i, label: raw || fallback });
  }

  const adminUsername = buildAdminUsername(serviceCode, usernameSlug);

  // Vendor ne dodjeljuje lozinke. Random seed hash; račun ostaje neaktivan dok admin ne kroz
  // invite flow ne postavi svoje + workshop lozinke.
  const seedSecret = crypto.randomBytes(24).toString("base64url");
  const seedHash = await bcrypt.hash(seedSecret, 12);

  try {
    const company = await prisma.$transaction(async (tx) => {
      const companyData: Prisma.CompanyUncheckedCreateInput = {
        name,
        oib,
        serviceCode,
        usernameSlug,
        street,
        city,
        postalCode,
        iban,
        email: accountEmail,
      };

      const created = await tx.company.create({ data: companyData });

      await tx.accountUser.create({
        data: {
          companyId: created.id,
          username: adminUsername,
          passwordHash: seedHash,
          role: "ADMIN",
          active: false,
          email: accountEmail,
        },
      });

      for (const spec of locationSpecs) {
        const location = await tx.companyServiceLocation.create({
          data: {
            companyId: created.id,
            kind: spec.kind,
            label: spec.label,
            ordinal: spec.ordinal,
          },
        });

        const username = buildLocationUsername(serviceCode, usernameSlug, spec.kind, spec.ordinal);
        await tx.accountUser.create({
          data: {
            companyId: created.id,
            username,
            passwordHash: seedHash,
            role: "WORKSHOP",
            active: false,
            email: accountEmail,
            serviceLocationId: location.id,
          },
        });
      }

      await syncCompanyServiceCatalog(tx, { companyId: created.id });

      return created;
    });

    return redirectRelative(`/platform/companies/${company.id}`, 303);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json({ error: "OIB, serviceCode ili username već postoji." }, { status: 409 });
    }
    console.error("[platform/companies/create] error:", e);
    return NextResponse.json({ error: "Greška kod kreiranja tvrtke." }, { status: 500 });
  }
}
