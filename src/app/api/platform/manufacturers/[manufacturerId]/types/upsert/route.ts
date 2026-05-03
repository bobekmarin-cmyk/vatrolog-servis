import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { formatExtinguisherTypeName } from "@/lib/formatExtinguisherType";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";
import { buildVariantSnapshot } from "@/lib/serviceVariant";

function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;

  const manufacturer = await prisma.manufacturer.findUnique({
    where: { id: manufacturerId },
    select: { id: true },
  });
  if (!manufacturer) {
    return NextResponse.json({ error: "Proizvođač nije pronađen." }, { status: 404 });
  }

  const body = (await req.json()) as {
    id?: string;
    code?: string;
    agentId?: string;
    constructionId?: string;
    capacity?: number | null;
    capacityUnit?: "KG" | "L" | null;
    internalRuleMode?: "FIXED" | "AGE_BASED";
    internalIntervalYears?: number | null;
    internalOldThresholdYears?: number | null;
    internalOldIntervalYears?: number | null;
    internalYoungIntervalYears?: number | null;
  };

  const code = String(body.code ?? "").trim().toUpperCase();
  const agentId = String(body.agentId ?? "").trim();
  const constructionId = String(body.constructionId ?? "").trim();

  if (!code) return badRequest("Code je obavezan.");
  if (!agentId) return badRequest("Sredstvo gašenja je obavezno.");
  if (!constructionId) return badRequest("Izvedba je obavezna.");

  const capacity =
    body.capacity !== null && body.capacity !== undefined && Number.isFinite(Number(body.capacity))
      ? Math.trunc(Number(body.capacity))
      : null;
  const capacityUnit: "KG" | "L" | null =
    capacity !== null ? (body.capacityUnit === "L" ? "L" : "KG") : null;

  const agent = await prisma.agentType.findUnique({ where: { id: agentId } });
  if (!agent) return badRequest("Nepoznato sredstvo gašenja.");
  const construction = await prisma.construction.findUnique({ where: { id: constructionId } });
  if (!construction) return badRequest("Nepoznata izvedba.");

  // Spriječi da se kreira tip čiji bi varijantni ključ pao u fallback granu —
  // to bi u `CompanyServiceCatalog` napravilo zaseban red odvojen od ekvivalentnih
  // tipova drugih proizvođača (npr. „FX6 (prah)" odvojeno od „P6 (ST, prah)").
  // CO2 se izvodi kroz agenta i smije ići u fallback po dizajnu.
  const isCo2 = agent.code === "CO2";
  if (!isCo2) {
    const snap = buildVariantSnapshot({
      code,
      agentId,
      constructionId,
      capacity,
      capacityUnit,
      construction: { prefix: construction.prefix },
    });
    if (snap.fallbackLabel !== null) {
      const reasons: string[] = [];
      if (!construction.prefix || construction.prefix.trim().length === 0) {
        reasons.push(`izvedba „${construction.label}" nema definiran prefiks`);
      }
      if (capacity == null) {
        reasons.push("količina (capacity) nije unesena");
      }
      const reasonText = reasons.length > 0 ? ` (${reasons.join("; ")})` : "";
      return NextResponse.json(
        {
          error:
            `Tip ne može biti spremljen jer bi se u šifrarniku usluga stvorila zasebna stavka${reasonText}. ` +
            "Provjeri da odabrana izvedba ima prefiks (P, S, …) i da je unesena količina.",
        },
        { status: 400 },
      );
    }
  }

  // Validacija pravila UP-a po tipu — UP je obavezan i definira se per-tip.
  const ruleModeRaw = body.internalRuleMode;
  if (ruleModeRaw !== "FIXED" && ruleModeRaw !== "AGE_BASED") {
    return badRequest("Pravilo unutarnjeg pregleda je obavezno (FIXED ili AGE_BASED).");
  }
  const internalRuleMode: "FIXED" | "AGE_BASED" = ruleModeRaw;
  let internalIntervalYears: number = 4;
  let internalOldThresholdYears: number | null = null;
  let internalOldIntervalYears: number | null = null;
  let internalYoungIntervalYears: number | null = null;

  function toIntOrNull(v: number | null | undefined): number | null {
    if (v == null) return null;
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  if (internalRuleMode === "FIXED") {
    const yrs = toIntOrNull(body.internalIntervalYears);
    if (yrs == null) {
      return badRequest("Za fiksni interval unesi pozitivan broj godina.");
    }
    internalIntervalYears = yrs;
  } else {
    // AGE_BASED — interval polja "young/old" su kritična, baseline interval
    // držimo u `internalIntervalYears` zbog uniformnog DB sheme (default 4).
    const yrs = toIntOrNull(body.internalIntervalYears) ?? 4;
    internalIntervalYears = yrs;
    internalOldThresholdYears = toIntOrNull(body.internalOldThresholdYears);
    internalOldIntervalYears = toIntOrNull(body.internalOldIntervalYears);
    internalYoungIntervalYears = toIntOrNull(body.internalYoungIntervalYears);
    if (
      internalOldThresholdYears == null ||
      internalOldIntervalYears == null ||
      internalYoungIntervalYears == null
    ) {
      return badRequest(
        "Za pravilo ovisno o starosti unesi sve vrijednosti: granica starosti, interval za mlade i interval za stare aparate.",
      );
    }
  }

  const displayName = formatExtinguisherTypeName({
    code,
    agent: { code: agent.code, label: agent.label, symbol: agent.symbol ?? null },
  });

  try {
    let typeId: string;

    if (body.id) {
      const existing = await prisma.extinguisherType.findUnique({
        where: { id: body.id },
        select: { id: true },
      });
      if (!existing) return NextResponse.json({ error: "Tip nije pronađen." }, { status: 404 });

      await prisma.extinguisherType.update({
        where: { id: body.id },
        data: {
          code,
          name: displayName,
          agentId,
          constructionId,
          capacity,
          capacityUnit,
          internalRuleMode,
          internalIntervalYears,
          internalOldThresholdYears,
          internalOldIntervalYears,
          internalYoungIntervalYears,
        },
      });
      typeId = body.id;
    } else {
      // upsert by unique (code, agentId)
      const existing = await prisma.extinguisherType.findUnique({
        where: { code_agentId: { code, agentId } },
        select: { id: true },
      });
      if (existing) {
        await prisma.extinguisherType.update({
          where: { id: existing.id },
          data: {
            name: displayName,
            constructionId,
            capacity,
            capacityUnit,
            internalRuleMode,
            internalIntervalYears,
            internalOldThresholdYears,
            internalOldIntervalYears,
            internalYoungIntervalYears,
          },
        });
        typeId = existing.id;
      } else {
        const created = await prisma.extinguisherType.create({
          data: {
            code,
            name: displayName,
            agentId,
            constructionId,
            capacity,
            capacityUnit,
            internalRuleMode,
            internalIntervalYears,
            internalOldThresholdYears,
            internalOldIntervalYears,
            internalYoungIntervalYears,
          },
          select: { id: true },
        });
        typeId = created.id;
      }
    }

    // osiguraj vezu proizvođač <-> tip
    await prisma.manufacturerExtinguisherType.upsert({
      where: {
        manufacturerId_extinguisherTypeId: {
          manufacturerId,
          extinguisherTypeId: typeId,
        },
      },
      update: {},
      create: { manufacturerId, extinguisherTypeId: typeId },
    });

    // Propagiraj tip u service catalog svih tvrtki (PERIODIC + INTERNAL).
    await syncCompanyServiceCatalog(null, { extinguisherTypeId: typeId });

    return NextResponse.json({ ok: true, id: typeId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique constraint") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "Tip s tim code-om i sredstvom već postoji." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Greška pri spremanju tipa." }, { status: 500 });
  }
}
