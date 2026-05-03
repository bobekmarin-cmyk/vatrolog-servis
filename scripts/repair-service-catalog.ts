/**
 * Repair tool for `CompanyServiceCatalog` variant rows.
 *
 * Detects `ExtinguisherType` records that fall into the variant-snapshot
 * fallback branch (because their construction has no prefix, or because
 * capacity is missing) and repairs them so they share a structured
 * `variantKey` with other types of the same (agent, construction, capacity)
 * triplet — instead of producing a duplicate `CompanyServiceCatalog` row.
 *
 * Run:
 *   npx ts-node -P tsconfig.seed.json scripts/repair-service-catalog.ts
 *   npx ts-node -P tsconfig.seed.json scripts/repair-service-catalog.ts --apply
 *   npx ts-node -P tsconfig.seed.json scripts/repair-service-catalog.ts --apply --force-orphan-cleanup
 */
import { PrismaClient } from "@prisma/client";
import { buildVariantSnapshot } from "../src/lib/serviceVariant";
import { syncCompanyServiceCatalog } from "../src/lib/companyServiceCatalog";

const prisma = new PrismaClient({ log: ["error", "warn"] });

const APPLY = process.argv.includes("--apply");
const FORCE_ORPHAN_CLEANUP = process.argv.includes("--force-orphan-cleanup");

// Heuristika code → prefix kad konstrukcija nema prefix.
// Dodaj nove mapinge ovdje ako se pojave nove izvedbe.
const PREFIX_HEURISTIC: Record<string, string> = {
  STORED_PRESSURE: "P",
  BOTTLE: "S",
};

type ConstructionRow = {
  id: string;
  code: string;
  label: string;
  prefix: string | null;
};

function header(title: string) {
  const line = "═".repeat(Math.max(8, title.length + 4));
  console.log(`\n${line}\n  ${title}\n${line}`);
}

function sub(title: string) {
  console.log(`\n──── ${title} ────`);
}

async function main() {
  header(APPLY ? "REPAIR (apply mode)" : "REPAIR (dry-run)");
  if (!APPLY) {
    console.log(
      "Dry-run: prikazujem što će se promijeniti. Pokreni s `--apply` da izvršiš promjene.",
    );
  } else {
    console.log("APPLY: izvodim popravke i brisanje orphan redova.");
    if (FORCE_ORPHAN_CLEANUP) {
      console.log("FORCE: brišem orphan redove i kad imaju spremljen `code`.");
    }
  }

  // 1) Konstrukcije
  sub("Konstrukcije (Construction)");
  const constructions = await prisma.construction.findMany({
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, label: true, prefix: true },
  });
  for (const c of constructions) {
    const prefixDisplay =
      c.prefix && c.prefix.trim().length > 0 ? c.prefix : "(prazno)";
    console.log(
      `  • ${c.code.padEnd(20)} prefix=${prefixDisplay.padEnd(8)} label="${c.label}"  id=${c.id}`,
    );
  }

  const noPrefix = constructions.filter((c) => !c.prefix || c.prefix.trim().length === 0);
  if (noPrefix.length > 0) {
    console.log(
      `\n  ! ${noPrefix.length} konstrukcija nema prefix (potencijalno generira fallback varijante).`,
    );
  }

  // 2) Tipovi aparata — koji bi išli u fallback?
  sub("Tipovi aparata u fallback grani (variantKey počinje s `v1c|`)");
  const types = await prisma.extinguisherType.findMany({
    select: {
      id: true,
      code: true,
      name: true,
      agentId: true,
      capacity: true,
      capacityUnit: true,
      constructionId: true,
      construction: { select: { id: true, code: true, label: true, prefix: true } },
      agent: { select: { id: true, code: true, label: true } },
    },
    orderBy: { code: "asc" },
  });

  type FallbackType = {
    typeId: string;
    typeCode: string;
    typeName: string;
    agentCode: string;
    construction: { id: string; code: string; label: string; prefix: string | null } | null;
    capacity: number | null;
    reason: string;
    expectedKeyIfPrefixSet: string | null;
  };
  const fallbackTypes: FallbackType[] = [];

  for (const t of types) {
    const snap = buildVariantSnapshot({
      code: t.code,
      agentId: t.agentId,
      constructionId: t.constructionId,
      capacity: t.capacity,
      capacityUnit: (t.capacityUnit as "KG" | "L" | null | undefined) ?? null,
      construction: t.construction,
    });
    if (snap.fallbackLabel === null) continue;

    const prefix = t.construction?.prefix?.trim() ?? "";
    const reasons: string[] = [];
    if (!prefix) reasons.push("construction.prefix prazan");
    if (t.capacity == null) reasons.push("capacity nije postavljen");
    if (!t.constructionId) reasons.push("constructionId null");

    // Što bi bio strukturirani ključ ako bismo postavili prefix (i ostalo je OK)
    const wouldBeStructured = !!t.constructionId && t.capacity != null;
    const expectedKey = wouldBeStructured
      ? `v1|${t.agentId}|${t.constructionId}|${t.capacity}|${t.capacityUnit ?? ""}`
      : null;

    fallbackTypes.push({
      typeId: t.id,
      typeCode: t.code,
      typeName: t.name,
      agentCode: t.agent?.code ?? "—",
      construction: t.construction,
      capacity: t.capacity,
      reason: reasons.join(" + "),
      expectedKeyIfPrefixSet: expectedKey,
    });

    console.log(
      `  • ${t.code.padEnd(12)} agent=${(t.agent?.code ?? "—").padEnd(8)} ` +
        `cap=${t.capacity ?? "—"}  ` +
        `construction=${t.construction?.code ?? "—"} prefix="${t.construction?.prefix ?? ""}" ` +
        `→ ${reasons.join(", ")}`,
    );
  }
  if (fallbackTypes.length === 0) {
    console.log("  (nijedan tip ne ide u fallback granu — sve je OK)");
  }

  // 3) Catalog redovi s fallbackLabel != null
  sub("CompanyServiceCatalog redovi s fallbackLabel != null");
  const catalogFallbackRows = await prisma.companyServiceCatalog.findMany({
    where: { fallbackLabel: { not: null } },
    select: {
      id: true,
      companyId: true,
      variantKey: true,
      kind: true,
      fallbackLabel: true,
      code: true,
      agentId: true,
    },
    orderBy: [{ companyId: "asc" }, { variantKey: "asc" }],
  });
  for (const r of catalogFallbackRows) {
    console.log(
      `  • company=${r.companyId.slice(0, 8)} kind=${r.kind.padEnd(8)} ` +
        `fallback="${r.fallbackLabel}" code=${r.code ?? "—"} key=${r.variantKey}`,
    );
  }
  if (catalogFallbackRows.length === 0) {
    console.log("  (nijedan fallback red u catalogu)");
  }

  // 4) Plan popravka
  sub("Plan popravka konstrukcija");
  const plans: Array<{
    target: ConstructionRow;
    action: "set-prefix" | "merge-into" | "manual";
    newPrefix?: string;
    mergeIntoId?: string;
    note: string;
  }> = [];

  for (const c of noPrefix) {
    // Postoji li druga konstrukcija s istim `code` koja ima prefix?
    const sameCode = constructions.find(
      (other) => other.id !== c.id && other.code === c.code && (other.prefix ?? "").trim().length > 0,
    );
    if (sameCode) {
      plans.push({
        target: c,
        action: "merge-into",
        mergeIntoId: sameCode.id,
        note: `Spojiti u ${sameCode.id} (code=${sameCode.code}, prefix=${sameCode.prefix})`,
      });
      continue;
    }
    const heuristicPrefix = PREFIX_HEURISTIC[c.code];
    if (heuristicPrefix) {
      plans.push({
        target: c,
        action: "set-prefix",
        newPrefix: heuristicPrefix,
        note: `Postaviti prefix="${heuristicPrefix}" (heuristika ${c.code} → ${heuristicPrefix})`,
      });
      continue;
    }
    plans.push({
      target: c,
      action: "manual",
      note: "Nema heuristike — unesi prefix ručno u platform admin postavkama izvedbi.",
    });
  }

  for (const p of plans) {
    console.log(`  • ${p.target.code} (${p.target.id}): ${p.action.toUpperCase()} — ${p.note}`);
  }
  if (plans.length === 0) {
    console.log("  (sve konstrukcije imaju prefix)");
  }

  if (!APPLY) {
    sub("Plan brisanja orphan catalog redova");
    // Izračunaj trenutne validne strukturirane keyeve za svaki tip — uzimajući u obzir
    // popravke konstrukcija planirane gore (set-prefix / merge-into).
    const futureValidKeys = await computeFutureValidKeys(types, plans);
    const currentValidKeys = new Set(
      types
        .map((t) => buildVariantSnapshot({
          code: t.code,
          agentId: t.agentId,
          constructionId: t.constructionId,
          capacity: t.capacity,
          capacityUnit: (t.capacityUnit as "KG" | "L" | null | undefined) ?? null,
          construction: t.construction,
        }).variantKey),
    );
    const orphans = catalogFallbackRows.filter(
      (r) => !futureValidKeys.has(r.variantKey) && !currentValidKeys.has(r.variantKey),
    );
    for (const r of orphans) {
      const flag = r.code ? " (IMA spremljen code — preskočit će se osim s --force-orphan-cleanup)" : "";
      console.log(`  • DELETE companyId=${r.companyId.slice(0, 8)} key=${r.variantKey}${flag}`);
    }
    if (orphans.length === 0) {
      console.log("  (nema orphan redova)");
    }

    sub("Sažetak");
    console.log(`  Konstrukcije bez prefiksa:                 ${noPrefix.length}`);
    console.log(`  Tipovi u fallback grani:                   ${fallbackTypes.length}`);
    console.log(`  Catalog redova s fallbackLabel != null:    ${catalogFallbackRows.length}`);
    console.log(`  Predloženi planovi popravka konstrukcija:  ${plans.length}`);
    console.log(`  Orphan catalog redova za brisanje:         ${orphans.length}`);
    console.log(`\n  Pokreni s --apply za izvršenje promjena.`);
    return;
  }

  // ───────────────────────────── APPLY MODE ─────────────────────────────
  header("APPLY: izvodim popravke");

  let setPrefixCount = 0;
  let mergeCount = 0;
  let manualCount = 0;
  for (const p of plans) {
    if (p.action === "set-prefix" && p.newPrefix) {
      await prisma.construction.update({
        where: { id: p.target.id },
        data: { prefix: p.newPrefix },
      });
      console.log(`  ✓ set-prefix: ${p.target.code} → "${p.newPrefix}"`);
      setPrefixCount += 1;
    } else if (p.action === "merge-into" && p.mergeIntoId) {
      const moved = await prisma.extinguisherType.updateMany({
        where: { constructionId: p.target.id },
        data: { constructionId: p.mergeIntoId },
      });
      await prisma.construction.delete({ where: { id: p.target.id } });
      console.log(
        `  ✓ merge: premješteno ${moved.count} tipova s ${p.target.id} → ${p.mergeIntoId}; obrisana stara konstrukcija`,
      );
      mergeCount += 1;
    } else {
      console.log(`  ! manual: ${p.target.code} — preskačem (treba ručno postaviti prefix)`);
      manualCount += 1;
    }
  }

  // 5) Resync
  sub("Resync svih varijanti (syncCompanyServiceCatalog)");
  const created = await syncCompanyServiceCatalog(null, {});
  console.log(`  ✓ Resync gotov; novokreiranih redova: ${created}`);

  // 6) Orphan cleanup
  sub("Brisanje orphan catalog redova");
  const types2 = await prisma.extinguisherType.findMany({
    select: {
      id: true,
      code: true,
      agentId: true,
      capacity: true,
      capacityUnit: true,
      constructionId: true,
      construction: { select: { prefix: true } },
    },
  });
  const validKeys = new Set(
    types2.map(
      (t) =>
        buildVariantSnapshot({
          code: t.code,
          agentId: t.agentId,
          constructionId: t.constructionId,
          capacity: t.capacity,
          capacityUnit: (t.capacityUnit as "KG" | "L" | null | undefined) ?? null,
          construction: t.construction,
        }).variantKey,
    ),
  );

  const allCatalog = await prisma.companyServiceCatalog.findMany({
    select: { id: true, companyId: true, variantKey: true, kind: true, code: true, fallbackLabel: true },
  });
  const orphans = allCatalog.filter((r) => !validKeys.has(r.variantKey));

  let deleted = 0;
  let skippedHasCode = 0;
  for (const r of orphans) {
    if (r.code && !FORCE_ORPHAN_CLEANUP) {
      console.log(
        `  ! preskačem orphan s code=${r.code} key=${r.variantKey} (companyId=${r.companyId.slice(0, 8)})`,
      );
      skippedHasCode += 1;
      continue;
    }
    await prisma.companyServiceCatalog.delete({ where: { id: r.id } });
    deleted += 1;
  }
  console.log(`  ✓ Obrisano orphan redova: ${deleted}`);
  if (skippedHasCode > 0) {
    console.log(
      `  ! Preskočeno redova sa spremljenim code-om: ${skippedHasCode}. Za brisanje koristi --force-orphan-cleanup.`,
    );
  }

  sub("Sažetak");
  console.log(`  set-prefix:        ${setPrefixCount}`);
  console.log(`  merge-into:        ${mergeCount}`);
  console.log(`  manual (skipped):  ${manualCount}`);
  console.log(`  resync created:    ${created}`);
  console.log(`  orphan deleted:    ${deleted}`);
  console.log(`  orphan skipped:    ${skippedHasCode}`);
}

/**
 * Vrati skup svih variantKey-eva koje će tipovi imati NAKON što se izvedu
 * planovi popravka (set-prefix / merge-into).
 */
async function computeFutureValidKeys(
  types: Array<{
    id: string;
    code: string;
    agentId: string;
    capacity: number | null;
    capacityUnit: string | null;
    constructionId: string;
    construction: { id: string; prefix: string | null } | null;
  }>,
  plans: Array<{
    target: { id: string; code: string };
    action: "set-prefix" | "merge-into" | "manual";
    newPrefix?: string;
    mergeIntoId?: string;
  }>,
): Promise<Set<string>> {
  const prefixOverride: Record<string, string> = {};
  const constructionIdRemap: Record<string, string> = {};
  for (const p of plans) {
    if (p.action === "set-prefix" && p.newPrefix) {
      prefixOverride[p.target.id] = p.newPrefix;
    } else if (p.action === "merge-into" && p.mergeIntoId) {
      constructionIdRemap[p.target.id] = p.mergeIntoId;
    }
  }
  // Za merge-into trebamo i prefix zamjenske konstrukcije.
  const allConstructions = await prisma.construction.findMany({
    select: { id: true, prefix: true },
  });
  const prefixById = new Map(allConstructions.map((c) => [c.id, c.prefix]));

  const out = new Set<string>();
  for (const t of types) {
    const remappedConstructionId = constructionIdRemap[t.constructionId] ?? t.constructionId;
    const prefix =
      prefixOverride[remappedConstructionId] ??
      prefixOverride[t.constructionId] ??
      prefixById.get(remappedConstructionId) ??
      t.construction?.prefix ??
      null;
    const snap = buildVariantSnapshot({
      code: t.code,
      agentId: t.agentId,
      constructionId: remappedConstructionId,
      capacity: t.capacity,
      capacityUnit: (t.capacityUnit as "KG" | "L" | null | undefined) ?? null,
      construction: { prefix: prefix },
    });
    out.add(snap.variantKey);
  }
  return out;
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e: unknown) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
