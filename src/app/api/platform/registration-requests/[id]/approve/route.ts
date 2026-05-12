import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { generateToken } from "@/lib/authTokens";
import {
  buildAdminUsername,
  buildLocationLabel,
  buildLocationUsername,
  isValidUsernameSlug,
  type LocationKind,
} from "@/lib/companyAccountNaming";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import { adminOnboardingEmail, sendSystemMail } from "@/lib/systemMail";
import { getAppBaseUrl } from "@/lib/appVersion";
import { logError, logInfo } from "@/lib/logger";
import { apiHandler } from "@/lib/apiHandler";
import { parseOrThrow } from "@/schemas";
import { emailSchema, ibanSchema, longText, shortText } from "@/schemas/common";

export const runtime = "nodejs";

const locationLabelSchema = z.object({
  kind: z.enum(["STATIONARY", "VEHICLE"]),
  ordinal: z.number().int().min(1).max(20),
  label: shortText(60),
});

const approveSchema = z.object({
  companyName: shortText(200),
  oib: shortText(20),
  street: shortText(300),
  city: shortText(100),
  postalCode: shortText(20),
  iban: ibanSchema,
  serviceCode: z.string().regex(/^\d{2}$/u, "Šifra servisa mora biti dvoznamenkasti broj."),
  usernameSlug: z
    .string()
    .regex(/^[a-z0-9]{2,15}$/u, "Slug može sadržavati samo a-z i 0-9 (2–15 znakova)."),
  adminEmail: emailSchema,
  stationaryCount: z.number().int().min(0).max(5),
  vehicleCount: z.number().int().min(0).max(20),
  locationLabels: z.array(locationLabelSchema).max(50).optional(),
  sendInvite: z.boolean().default(true),
  approvalNote: longText(500).nullable().optional(),
});

export const POST = apiHandler(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ps = await getPlatformSession();
    if (!ps) {
      return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = parseOrThrow(approveSchema, body);

    if (!isValidUsernameSlug(parsed.usernameSlug)) {
      return NextResponse.json({ error: "Neispravan slug." }, { status: 400 });
    }

    const totalLocations = parsed.stationaryCount + parsed.vehicleCount;
    if (totalLocations === 0) {
      return NextResponse.json(
        { error: "Mora postojati barem jedna servisna lokacija." },
        { status: 400 },
      );
    }

    const reg = await prisma.registrationRequest.findUnique({ where: { id } });
    if (!reg) {
      return NextResponse.json({ error: "Zahtjev nije pronađen." }, { status: 404 });
    }
    if (reg.status !== "PENDING") {
      return NextResponse.json(
        { error: `Zahtjev je već u stanju ${reg.status}.` },
        { status: 409 },
      );
    }

    // Konfliktni OIB / serviceCode prije transakcije (prijateljska poruka).
    const [conflictOib, conflictCode] = await Promise.all([
      prisma.company.findUnique({ where: { oib: parsed.oib } }),
      prisma.company.findUnique({ where: { serviceCode: parsed.serviceCode } }),
    ]);
    if (conflictOib) {
      return NextResponse.json(
        {
          error: `Tvrtka s OIB-om ${parsed.oib} već postoji. Otvori je iz Tvrtki ili odbij zahtjev.`,
        },
        { status: 409 },
      );
    }
    if (conflictCode) {
      return NextResponse.json(
        { error: `Šifra servisa ${parsed.serviceCode} je već zauzeta.` },
        { status: 409 },
      );
    }

    // Mapa labela po (kind:ordinal) iz UI-ja.
    const labelMap = new Map<string, string>();
    for (const l of parsed.locationLabels ?? []) {
      labelMap.set(`${l.kind}:${l.ordinal}`, l.label);
    }

    type LocationSpec = { kind: LocationKind; ordinal: number; label: string };
    const locationSpecs: LocationSpec[] = [];
    for (let i = 1; i <= parsed.stationaryCount; i++) {
      const fallback = buildLocationLabel("STATIONARY", i);
      const label = labelMap.get(`STATIONARY:${i}`)?.trim() || fallback;
      locationSpecs.push({ kind: "STATIONARY", ordinal: i, label });
    }
    for (let i = 1; i <= parsed.vehicleCount; i++) {
      const fallback = buildLocationLabel("VEHICLE", i);
      const label = labelMap.get(`VEHICLE:${i}`)?.trim() || fallback;
      locationSpecs.push({ kind: "VEHICLE", ordinal: i, label });
    }

    const adminUsername = buildAdminUsername(parsed.serviceCode, parsed.usernameSlug);
    const seedSecret = crypto.randomBytes(24).toString("base64url");
    const seedHash = await bcrypt.hash(seedSecret, 12);

    let createdCompanyId: string | null = null;
    let createdAdminAccountId: string | null = null;

    const TRIAL_DAYS = 14;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    try {
      const created = await prisma.$transaction(async (tx) => {
        const companyData: Prisma.CompanyUncheckedCreateInput = {
          name: parsed.companyName,
          oib: parsed.oib,
          serviceCode: parsed.serviceCode,
          usernameSlug: parsed.usernameSlug,
          street: parsed.street,
          city: parsed.city,
          postalCode: parsed.postalCode,
          iban: parsed.iban,
          email: parsed.adminEmail.toLowerCase(),
          trialEndsAt,
          activeUntil: trialEndsAt,
        };
        const company = await tx.company.create({ data: companyData });

        const adminAccount = await tx.accountUser.create({
          data: {
            companyId: company.id,
            username: adminUsername,
            passwordHash: seedHash,
            role: "ADMIN",
            active: false,
            email: parsed.adminEmail.toLowerCase(),
          },
        });

        for (const spec of locationSpecs) {
          const location = await tx.companyServiceLocation.create({
            data: {
              companyId: company.id,
              kind: spec.kind,
              label: spec.label,
              ordinal: spec.ordinal,
            },
          });
          const username = buildLocationUsername(
            parsed.serviceCode,
            parsed.usernameSlug,
            spec.kind,
            spec.ordinal,
          );
          await tx.accountUser.create({
            data: {
              companyId: company.id,
              username,
              passwordHash: seedHash,
              role: "WORKSHOP",
              active: false,
              email: parsed.adminEmail.toLowerCase(),
              serviceLocationId: location.id,
            },
          });
        }

        await syncCompanyServiceCatalog(tx, { companyId: company.id });

        await tx.registrationRequest.update({
          where: { id: reg.id },
          data: {
            status: "CONVERTED",
            approvedAt: new Date(),
            approvedByPlatformUserId: ps.platformUserId,
            approvalNote: parsed.approvalNote ?? null,
            companyId: company.id,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: company.id,
            actorType: "PLATFORM",
            action: "registration_request.approve",
            entity: "RegistrationRequest",
            entityId: reg.id,
            meta: {
              serviceCode: parsed.serviceCode,
              usernameSlug: parsed.usernameSlug,
              adminEmail: parsed.adminEmail.toLowerCase(),
              stationaryCount: parsed.stationaryCount,
              vehicleCount: parsed.vehicleCount,
              note: parsed.approvalNote ?? null,
            },
          },
        });

        return { company, adminAccount };
      });

      createdCompanyId = created.company.id;
      createdAdminAccountId = created.adminAccount.id;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("Unique constraint") || msg.includes("unique")) {
        return NextResponse.json(
          { error: "Konflikt: OIB, serviceCode ili username već postoji." },
          { status: 409 },
        );
      }
      logError("registration_request_approve_failed", e, { requestId: reg.id });
      return NextResponse.json(
        { error: "Greška kod kreiranja tvrtke. Provjeri logove." },
        { status: 500 },
      );
    }

    let inviteSent = false;
    let inviteError: string | null = null;

    if (parsed.sendInvite && createdCompanyId && createdAdminAccountId) {
      try {
        const { plaintext, hash } = generateToken();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7d

        await prisma.$transaction([
          prisma.authToken.updateMany({
            where: {
              accountUserId: createdAdminAccountId,
              type: "ACCOUNT_INVITE",
              usedAt: null,
            },
            data: { usedAt: new Date() },
          }),
          prisma.authToken.create({
            data: {
              type: "ACCOUNT_INVITE",
              tokenHash: hash,
              accountUserId: createdAdminAccountId,
              companyId: createdCompanyId,
              email: parsed.adminEmail.toLowerCase(),
              expiresAt,
            },
          }),
        ]);

        const acceptUrl = `${getAppBaseUrl()}/auth/invite/${encodeURIComponent(plaintext)}`;
        const workshopUsernames = locationSpecs.map((s) =>
          buildLocationUsername(parsed.serviceCode, parsed.usernameSlug, s.kind, s.ordinal),
        );
        const tpl = await adminOnboardingEmail({
          companyName: parsed.companyName,
          serviceCode: parsed.serviceCode,
          usernames: { admin: adminUsername, workshops: workshopUsernames },
          acceptUrl,
        });
        const sent = await sendSystemMail({
          to: parsed.adminEmail.toLowerCase(),
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          kind: "ACCOUNT_INVITE",
          companyId: createdCompanyId,
          accountUserId: createdAdminAccountId,
        });
        if (sent.ok) {
          inviteSent = true;
          await prisma.auditLog.create({
            data: {
              companyId: createdCompanyId,
              actorType: "PLATFORM",
              action: "account.invite.send",
              entity: "AccountUser",
              entityId: createdAdminAccountId,
              meta: {
                username: adminUsername,
                role: "ADMIN",
                to: parsed.adminEmail.toLowerCase(),
                expiresAt: expiresAt.toISOString(),
                trigger: "registration_request.approve",
              },
            },
          });
        } else {
          inviteError = sent.error;
        }
      } catch (e: unknown) {
        inviteError = e instanceof Error ? e.message : "Slanje pozivnice nije uspjelo.";
        logError("registration_request_invite_failed", e, {
          companyId: createdCompanyId,
          accountUserId: createdAdminAccountId,
        });
      }
    }

    logInfo("registration_request_approved", {
      requestId: reg.id,
      companyId: createdCompanyId,
      inviteSent,
      inviteError,
    });

    return NextResponse.json({
      ok: true,
      companyId: createdCompanyId,
      inviteSent,
      inviteError,
    });
  },
);
