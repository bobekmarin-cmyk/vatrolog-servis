import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { getPlatformSettings, upsertPlatformSettings } from "@/lib/platformSettings";

const Body = z.object({
  defaultFromName: z.string().trim().max(120).nullable().optional(),
  defaultFromEmail: z.string().trim().email("Neispravan email.").nullable().optional().or(z.literal("")),
  signatureHtml: z.string().max(5000).nullable().optional(),
  logoUrl: z.string().trim().max(500).nullable().optional(),
  brandColor: z
    .string()
    .trim()
    .regex(/^#?[0-9a-fA-F]{3,8}$/, "Neispravan hex color.")
    .nullable()
    .optional(),
});

function normalize(input: z.infer<typeof Body>) {
  const norm = (v: string | null | undefined) =>
    v == null ? null : v.trim() === "" ? null : v.trim();
  return {
    defaultFromName: norm(input.defaultFromName),
    defaultFromEmail: norm(input.defaultFromEmail as string | null | undefined),
    signatureHtml: input.signatureHtml ?? null,
    logoUrl: norm(input.logoUrl),
    brandColor: norm(input.brandColor),
  };
}

export async function GET() {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  const s = await getPlatformSettings();
  return NextResponse.json({
    defaultFromName: s?.defaultFromName ?? null,
    defaultFromEmail: s?.defaultFromEmail ?? null,
    signatureHtml: s?.signatureHtml ?? null,
    logoUrl: s?.logoUrl ?? null,
    brandColor: s?.brandColor ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch (e: unknown) {
    const msg = e instanceof ZodError ? (e.issues[0]?.message ?? "Neispravan zahtjev.") : "Neispravan zahtjev.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const data = normalize(parsed);
  await upsertPlatformSettings(data);

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.settings.branding.update",
      entity: "PlatformSettings",
      meta: data,
    },
  });

  return NextResponse.json({ ok: true });
}
