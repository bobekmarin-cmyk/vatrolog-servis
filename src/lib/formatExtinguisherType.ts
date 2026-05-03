/**
 * Jedinstveni prikaz naziva tipa aparata: kod + medij u zagradi, npr. "P6 (prah)".
 *
 * `agent` moze biti:
 *  - relation object iz baze: { code, label?, symbol? }
 *  - legacy string kod: "PRAH" / "CO2"
 *  - null / undefined
 */

type AgentLike =
  | string
  | {
      code?: string;
      label?: string | null;
      symbol?: string | null;
    }
  | null
  | undefined;

const LEGACY_MEDIJ_LOWER: Record<string, string> = {
  PRAH: "prah",
  PJENA: "pjena",
  VODA: "voda",
  WET_CHEMICAL: "wet chem.",
  CO2: "CO₂",
  F500: "F-500",
  OTHER: "ostalo",
};

export function formatAgentLabel(agent: AgentLike): string {
  if (!agent) return "";
  if (typeof agent === "string") {
    return LEGACY_MEDIJ_LOWER[agent] ?? agent.toLowerCase();
  }
  if (agent.code && LEGACY_MEDIJ_LOWER[agent.code]) {
    return LEGACY_MEDIJ_LOWER[agent.code];
  }
  if (agent.label) return agent.label.toLowerCase();
  if (agent.symbol) return agent.symbol;
  if (agent.code) return agent.code.toLowerCase();
  return "";
}

export function formatExtinguisherTypeName(t: {
  code: string;
  agent?: AgentLike;
  construction?: ConstructionLike;
}): string {
  const medij = formatAgentLabel(t.agent ?? null);
  const izvedba = formatConstructionShort(t.construction ?? null);
  const metaParts = [izvedba, medij].filter((x) => x && x.length > 0);
  return metaParts.length > 0 ? `${t.code} (${metaParts.join(", ")})` : t.code;
}

type ConstructionLike =
  | {
      code?: string | null;
      label?: string | null;
    }
  | null
  | undefined;

const LEGACY_CONSTRUCTION_SHORT: Record<string, string> = {
  STORED_PRESSURE: "ST",
  CARTRIDGE: "BO",
  CO2: "CO₂",
};

/**
 * Kratka oznaka izvedbe za prikaz u dropdownu, npr.
 *  "Stalni tlak" -> "ST", "Bočica" -> "BO", "CO2" -> "CO₂".
 *  Platform owner moze dodati svoje izvedbe; tada se oznaka
 *  izvodi iz labela (inicijali visewordnih naziva, inace prva dva slova).
 */
export function formatConstructionShort(c: ConstructionLike): string {
  if (!c) return "";
  if (c.code && LEGACY_CONSTRUCTION_SHORT[c.code]) {
    return LEGACY_CONSTRUCTION_SHORT[c.code];
  }
  const label = (c.label ?? "").trim();
  if (!label) return c.code ?? "";
  if (label.length <= 3) return label.toUpperCase();
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map((p) => p[0]).join("").toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

/**
 * Vraca razbijen prikaz za dropdown: glavni dio (code) i pomocni
 * "(ST, prah)" koji se renderira sivom bojom.
 */
export function formatExtinguisherTypeParts(t: {
  code: string;
  agent?: AgentLike;
  construction?: ConstructionLike;
}): { main: string; meta: string } {
  const medij = formatAgentLabel(t.agent ?? null);
  const izvedba = formatConstructionShort(t.construction ?? null);
  const metaParts = [izvedba, medij].filter((x) => x && x.length > 0);
  return {
    main: t.code,
    meta: metaParts.length > 0 ? metaParts.join(", ") : "",
  };
}
