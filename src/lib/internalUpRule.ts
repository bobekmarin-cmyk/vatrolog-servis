/**
 * Pravilo unutarnjeg pregleda (UP).
 *
 * Izvori (po prioritetu):
 *  1. Override za CO2 agens   -> svakih 5 god (pravilo po agensu).
 *  2. ExtinguisherType        -> obavezno definirano per-tip (FIXED ili AGE_BASED).
 *  3. FALLBACK fiksno         -> ako tip ima nepotpunu konfiguraciju (ne bi se
 *                                trebalo dogoditi nakon migracije, ali defenzivno).
 *
 *  - FIXED:     uvijek `internalIntervalYears` (npr. Total = 4).
 *  - AGE_BASED: age = baseYear - productionYear
 *               age >= internalOldThresholdYears -> internalOldIntervalYears
 *               inace                             -> internalYoungIntervalYears
 *               (npr. Pastor: prag 14, mladi 5, stari 2)
 *
 * Pravilo prvog UP-a:  firstUpYear = productionYear + interval
 * Pravilo iduceg UP-a: nextUpYear  = baseYear      + interval
 *   (baseYear = godina servisa na kojem je UP napravljen)
 */

export type UpRuleInputType = {
  internalRuleMode: "FIXED" | "AGE_BASED";
  internalIntervalYears: number;
  internalOldThresholdYears: number | null;
  internalOldIntervalYears: number | null;
  internalYoungIntervalYears: number | null;
};

export type UpIntervalResult = {
  years: number;
  ruleLabel: string;
  source: "CO2_OVERRIDE" | "FIXED" | "AGE_BASED" | "FALLBACK";
  /** "type" = pravilo dolazi s ExtinguisherType, "co2" / "fallback" = ostalo. */
  origin: "type" | "co2" | "fallback";
};

const FALLBACK_INTERVAL = 4;

type NormalizedRule = {
  mode: "FIXED" | "AGE_BASED";
  internalIntervalYears: number;
  internalOldThresholdYears: number | null;
  internalOldIntervalYears: number | null;
  internalYoungIntervalYears: number | null;
};

/** Vrati normalizirano pravilo s tipa ako je validno, inače null. */
function ruleFromType(t: UpRuleInputType): NormalizedRule | null {
  if (t.internalRuleMode === "FIXED") {
    const years = Number(t.internalIntervalYears);
    if (!Number.isFinite(years) || years <= 0) return null;
    return {
      mode: "FIXED",
      internalIntervalYears: Math.floor(years),
      internalOldThresholdYears: null,
      internalOldIntervalYears: null,
      internalYoungIntervalYears: null,
    };
  }
  // AGE_BASED
  const threshold = t.internalOldThresholdYears;
  const oldI = t.internalOldIntervalYears;
  const youngI = t.internalYoungIntervalYears;
  if (
    threshold == null ||
    oldI == null ||
    youngI == null ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(oldI) ||
    !Number.isFinite(youngI) ||
    oldI <= 0 ||
    youngI <= 0
  ) {
    return null;
  }
  return {
    mode: "AGE_BASED",
    internalIntervalYears: Number(t.internalIntervalYears ?? 0),
    internalOldThresholdYears: Math.floor(threshold),
    internalOldIntervalYears: Math.floor(oldI),
    internalYoungIntervalYears: Math.floor(youngI),
  };
}

function applyRule(
  rule: NormalizedRule,
  baseYear: number,
  productionYear: number,
  originSuffix: string,
): { years: number; ruleLabel: string; source: "FIXED" | "AGE_BASED" | "FALLBACK" } {
  if (rule.mode === "FIXED") {
    const years = rule.internalIntervalYears;
    if (!Number.isFinite(years) || years <= 0) {
      return {
        years: FALLBACK_INTERVAL,
        ruleLabel: `Fallback fiksni interval ${FALLBACK_INTERVAL} god (nepotpuna konfiguracija)`,
        source: "FALLBACK",
      };
    }
    return {
      years: Math.floor(years),
      ruleLabel: `Fiksni interval: svakih ${Math.floor(years)} god ${originSuffix}`.trim(),
      source: "FIXED",
    };
  }
  const threshold = rule.internalOldThresholdYears;
  const oldI = rule.internalOldIntervalYears;
  const youngI = rule.internalYoungIntervalYears;
  if (
    threshold == null ||
    oldI == null ||
    youngI == null ||
    !Number.isFinite(threshold) ||
    !Number.isFinite(oldI) ||
    !Number.isFinite(youngI) ||
    oldI <= 0 ||
    youngI <= 0
  ) {
    return {
      years: FALLBACK_INTERVAL,
      ruleLabel: `Fallback fiksni interval ${FALLBACK_INTERVAL} god (nepotpuna AGE_BASED konfiguracija)`,
      source: "FALLBACK",
    };
  }
  const age = baseYear - productionYear;
  const isOld = age >= threshold;
  const years = isOld ? Math.floor(oldI) : Math.floor(youngI);
  const ruleLabel =
    `Ovisno o starosti: mladi (<${threshold} god) -> ${Math.floor(youngI)}, ` +
    `stari (>=${threshold} god) -> ${Math.floor(oldI)}` +
    ` | Trenutno: ${isOld ? "stari" : "mladi"} (${age} god) ${originSuffix}`.trim();
  return {
    years,
    ruleLabel,
    source: "AGE_BASED",
  };
}

export function computeUpInterval(args: {
  extinguisherType: UpRuleInputType;
  agentCode: string | null;
  productionYear: number;
  baseYear: number;
}): UpIntervalResult {
  const { extinguisherType, agentCode, productionYear, baseYear } = args;

  if ((agentCode ?? "").toUpperCase() === "CO2") {
    return {
      years: 5,
      ruleLabel: "CO2 -> svakih 5 godina (pravilo po agensu)",
      source: "CO2_OVERRIDE",
      origin: "co2",
    };
  }

  const typeRule = ruleFromType(extinguisherType);
  if (typeRule) {
    const out = applyRule(typeRule, baseYear, productionYear, "(po tipu aparata)");
    return { ...out, origin: "type" };
  }

  // Defenzivni fallback — tip bi nakon migracije uvijek trebao imati validno
  // pravilo, ali ako iz nekog razloga nedostaje, vrati hardcoded 4 god.
  return {
    years: FALLBACK_INTERVAL,
    ruleLabel: `Fallback fiksni interval ${FALLBACK_INTERVAL} god (tip nema definirano pravilo UP-a)`,
    source: "FALLBACK",
    origin: "fallback",
  };
}

export function computeFirstUpYear(
  productionYear: number,
  years: number,
): number {
  return productionYear + Math.max(1, Math.floor(years));
}

export function computeNextUpYear(baseYear: number, years: number): number {
  return baseYear + Math.max(1, Math.floor(years));
}
