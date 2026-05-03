/**
 * Formatira naziv usluge za prikaz na otpremnici i u admin katalogu usluga.
 *
 * Pravila:
 *  - baza = `{construction.prefix}{capacity}` (npr. "P2", "S9")
 *  - CO2 iznimka (agent/prefix CO2): baza = `{prefix}-{capacity}` → "CO2-5"
 *  - ako construction.prefix ili capacity nedostaju → fallback na type.code / fallbackLabel
 *  - meta u zagradi = "(constructionShort, agent)" (npr. "(ST, prah)")
 *  - CO2 iznimka: kad je agent.code === "CO2" → prikazuje se samo baza bez zagrade
 *  - konačni format uz kind: "{kindLabel} {base} ({meta})"
 *    npr. "Periodični pregled P2 (ST, prah)", "Unutarnji pregled P9 (ST, pjena)",
 *         "Periodični pregled CO2-5"
 */

import { formatAgentLabel, formatConstructionShort } from "./formatExtinguisherType";

export type ServiceKindValue = "PERIODIC" | "INTERNAL";

export function serviceKindLabel(kind: ServiceKindValue): string {
  return kind === "PERIODIC" ? "Periodični pregled" : "Unutarnji pregled";
}

type AgentInput = {
  code?: string;
  label?: string | null;
  symbol?: string | null;
} | null;

type ConstructionInput = {
  code?: string | null;
  label?: string | null;
  prefix?: string | null;
} | null;

type TypeInput = {
  code: string;
  capacity?: number | null;
  agent?: AgentInput;
  construction?: ConstructionInput;
};

/** Zajednička logika: vraća glavni dio labele ("P2", "S9", "CO2-5"). */
function computeMain(input: {
  prefix: string;
  capacity: number | null;
  agentCode: string | null;
  fallback: string;
}): string {
  const isCO2 = input.agentCode === "CO2" || input.prefix === "CO2";
  if (input.prefix && input.capacity != null) {
    return isCO2 ? `${input.prefix}-${input.capacity}` : `${input.prefix}${input.capacity}`;
  }
  return input.fallback;
}

/** Vraća glavni dio ("P2", "S9", "CO2-5") i meta dio ("ST, prah") za tip aparata. */
export function formatServiceItemParts(type: TypeInput): { main: string; meta: string } {
  const prefix = type.construction?.prefix?.trim() ?? "";
  const agentCode = type.agent?.code ?? null;

  const main = computeMain({
    prefix,
    capacity: type.capacity ?? null,
    agentCode,
    fallback: type.code,
  });

  if (agentCode === "CO2") {
    return { main, meta: "" };
  }

  const izvedba = formatConstructionShort(type.construction ?? null);
  const medij = formatAgentLabel(type.agent ?? null);
  const metaParts = [izvedba, medij].filter((x) => x && x.length > 0);
  return { main, meta: metaParts.join(", ") };
}

/** Vraća spojeni naziv npr. "P2 (ST, prah)" ili "CO2-5". */
export function formatServiceItemName(type: TypeInput): string {
  const { main, meta } = formatServiceItemParts(type);
  return meta ? `${main} (${meta})` : main;
}

/** Vraća puni naziv usluge, npr. "Periodični pregled P2 (ST, prah)". */
export function formatServiceItemLabel(type: TypeInput, kind: ServiceKindValue): string {
  return `${serviceKindLabel(kind)} ${formatServiceItemName(type)}`;
}

/**
 * Varijantni prikaz — prima podatke iz `CompanyServiceCatalog` retka ili iz
 * `VariantSnapshot`-a (stupci `agent`, `construction`, `capacity`,
 * `fallbackLabel`). Koristi se na admin stranici i na otpremnici umjesto
 * `ExtinguisherType`-specifičnog helpera.
 */
export type VariantLabelInput = {
  agent?: AgentInput;
  construction?: ConstructionInput;
  capacity?: number | null;
  fallbackLabel?: string | null;
};

export function formatVariantParts(row: VariantLabelInput): { main: string; meta: string } {
  const prefix = row.construction?.prefix?.trim() ?? "";
  const agentCode = row.agent?.code ?? null;

  const main = computeMain({
    prefix,
    capacity: row.capacity ?? null,
    agentCode,
    fallback: row.fallbackLabel ?? "",
  });

  if (agentCode === "CO2") {
    return { main, meta: "" };
  }

  const izvedba = formatConstructionShort(row.construction ?? null);
  const medij = formatAgentLabel(row.agent ?? null);
  const metaParts = [izvedba, medij].filter((x) => x && x.length > 0);
  return { main, meta: metaParts.join(", ") };
}

export function formatVariantName(row: VariantLabelInput): string {
  const { main, meta } = formatVariantParts(row);
  return meta ? `${main} (${meta})` : main;
}

export function formatVariantLabel(row: VariantLabelInput, kind: ServiceKindValue): string {
  return `${serviceKindLabel(kind)} ${formatVariantName(row)}`;
}

/**
 * Varijantni prikaz za **spojene** retke na otpremnici — kad više varijanti
 * (različiti agent, ista izvedba/kapacitet/kind) dijeli istu šifru i
 * prikazuje se u jednom redu, medij se ne navodi u zagradi. Ostavlja se samo
 * kratica izvedbe. Npr. "P9 (ST)".
 *
 * Ako je `agent` postavljen (jedna varijanta, nije spojeno), delegira na
 * regularni `formatVariantName`.
 */
export function formatMergedVariantName(row: VariantLabelInput): string {
  if (row.agent) return formatVariantName(row);

  const { main } = formatVariantParts({ ...row, agent: null });
  const prefix = row.construction?.prefix?.trim() ?? "";
  const isCO2 = prefix === "CO2";
  if (isCO2) return main;

  const izvedba = formatConstructionShort(row.construction ?? null);
  return izvedba && izvedba.length > 0 ? `${main} (${izvedba})` : main;
}
