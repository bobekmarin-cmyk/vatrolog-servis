type UnknownRecord = Record<string, unknown>;

export type SudregCompanyData = {
  oib: string;
  name: string;
  shortName: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  address: string;
  email: string | null;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function getRequiredEnv(name: "SUDREG_CLIENT_ID" | "SUDREG_CLIENT_SECRET"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    // Distinct error code so route handlers mogu vratiti jasnu poruku
    // umjesto generic "Greška pri dohvaćanju podataka".
    throw new Error("SUDREG_NOT_CONFIGURED");
  }
  return value;
}

function normalizeOib(input: string): string {
  return input.replace(/\D/g, "");
}

function getTokenUrl(): string {
  return process.env.SUDREG_TOKEN_URL?.trim() || "https://sudreg-data.gov.hr/api/oauth/token";
}

function getApiBaseUrl(): string {
  return process.env.SUDREG_API_BASE_URL?.trim() || "https://sudreg-data.gov.hr/api/javni/v1";
}

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - 15_000 > now) return cachedToken.value;

  const clientId = getRequiredEnv("SUDREG_CLIENT_ID");
  const clientSecret = getRequiredEnv("SUDREG_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(getTokenUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`SUDREG_TOKEN_FAILED_${response.status}`);
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("SUDREG_TOKEN_MISSING");

  const ttlMs = Math.max((body.expires_in ?? 21_600) - 60, 60) * 1000;
  cachedToken = {
    value: body.access_token,
    expiresAt: now + ttlMs,
  };
  return body.access_token;
}

function pickActiveRow<T extends UnknownRecord>(rows: unknown): T | null {
  if (!Array.isArray(rows)) return null;
  const objects = rows.filter((x): x is T => !!x && typeof x === "object");
  if (objects.length === 0) return null;
  return (
    objects.find((x) => Number((x as UnknownRecord).status) === 1) ??
    objects.find((x) => !("status" in (x as UnknownRecord))) ??
    objects[0]
  );
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFirstString(input: unknown, keys: string[]): string | null {
  if (!input || typeof input !== "object") return null;
  const targetKeys = new Set(keys.map((k) => k.toLowerCase()));
  const queue: unknown[] = [input];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      for (const item of current) queue.push(item);
      continue;
    }

    const obj = current as UnknownRecord;
    for (const [key, value] of Object.entries(obj)) {
      if (targetKeys.has(key.toLowerCase())) {
        const candidate = toNonEmptyString(value);
        if (candidate) return candidate;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function buildAddress(sjediste: UnknownRecord | null): string | null {
  if (!sjediste) return null;

  const ulica = toNonEmptyString(sjediste.ulica);
  const kucniBroj = toNonEmptyString(sjediste.kucni_broj);
  const kucniPodbroj = toNonEmptyString(sjediste.kucni_podbroj);
  const postanskiBroj = toNonEmptyString(sjediste.postanski_broj);
  const naselje =
    toNonEmptyString(sjediste.naziv_naselja) ??
    toNonEmptyString(sjediste.naselje_van_sifrarnika) ??
    toNonEmptyString(sjediste.naziv_opcine);

  const streetLine = [ulica, kucniBroj, kucniPodbroj].filter(Boolean).join(" ").trim();
  const cityLine = [postanskiBroj, naselje].filter(Boolean).join(" ").trim();
  const combined = [streetLine, cityLine].filter(Boolean).join(", ").trim();
  return combined || toNonEmptyString(sjediste.adresa);
}

function extractAddressParts(sjediste: UnknownRecord | null): {
  street: string | null;
  postalCode: string | null;
  city: string | null;
} {
  if (!sjediste) {
    return { street: null, postalCode: null, city: null };
  }

  const ulica = toNonEmptyString(sjediste.ulica);
  const kucniBroj = toNonEmptyString(sjediste.kucni_broj);
  const kucniPodbroj = toNonEmptyString(sjediste.kucni_podbroj);
  const postalCode = toNonEmptyString(sjediste.postanski_broj);
  const city =
    toNonEmptyString(sjediste.naziv_naselja) ??
    toNonEmptyString(sjediste.naselje_van_sifrarnika) ??
    toNonEmptyString(sjediste.naziv_opcine);

  const street = [ulica, kucniBroj, kucniPodbroj].filter(Boolean).join(" ").trim() || null;
  return { street, postalCode, city };
}

function parseCompanyData(raw: unknown, expectedOib: string): SudregCompanyData | null {
  const root = (raw ?? {}) as UnknownRecord;
  const subject = pickActiveRow<UnknownRecord>(root.subjekti) ?? root;
  const tvrtka = pickActiveRow<UnknownRecord>((subject as UnknownRecord).tvrtke);
  const skracenaTvrtka = pickActiveRow<UnknownRecord>((subject as UnknownRecord).skracene_tvrtke);
  const sjediste = pickActiveRow<UnknownRecord>((subject as UnknownRecord).sjedista);
  const emailRow = pickActiveRow<UnknownRecord>((subject as UnknownRecord).email_adrese);

  const name =
    toNonEmptyString(tvrtka?.ime) ??
    extractFirstString(subject, ["ime", "naziv", "tvrtka", "naziv_subjekta"]);
  const address =
    buildAddress(sjediste) ??
    extractFirstString(subject, ["adresa", "sjediste", "ulica", "postanski_broj"]);
  const addressParts = extractAddressParts(sjediste);
  const shortName =
    toNonEmptyString(skracenaTvrtka?.ime) ??
    extractFirstString(subject, ["skracena_tvrtka", "skraceni_naziv", "ime_skracene_tvrtke"]);
  const email =
    toNonEmptyString(emailRow?.adresa) ??
    extractFirstString(subject, ["email", "email_adresa", "adresa"]);
  const oib =
    normalizeOib(
      toNonEmptyString((subject as UnknownRecord).oib) ??
        extractFirstString(subject, ["oib"]) ??
        expectedOib
    ) || expectedOib;

  if (!name || !address) return null;

  return {
    oib,
    name,
    shortName,
    street: addressParts.street,
    postalCode: addressParts.postalCode,
    city: addressParts.city,
    address,
    email,
  };
}

export async function fetchCompanyByOibFromSudreg(inputOib: string): Promise<SudregCompanyData> {
  const oib = normalizeOib(inputOib);
  if (!/^\d{11}$/.test(oib)) {
    throw new Error("INVALID_OIB");
  }

  const accessToken = await getAccessToken();
  const url = new URL(`${getApiBaseUrl().replace(/\/$/, "")}/subjekt_detalji`);
  url.searchParams.set("tipIdentifikatora", "oib");
  url.searchParams.set("identifikator", oib);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { error_code?: number } | null;
      if (body?.error_code === 505) throw new Error("SUBJECT_NOT_FOUND");
      throw new Error("SUDREG_BAD_REQUEST");
    }
    if (response.status === 404) throw new Error("SUBJECT_NOT_FOUND");
    if (response.status === 401) throw new Error("SUDREG_UNAUTHORIZED");
    throw new Error(`SUDREG_LOOKUP_FAILED_${response.status}`);
  }

  const raw = await response.json();
  const parsed = parseCompanyData(raw, oib);
  if (!parsed) throw new Error("SUDREG_PARSE_FAILED");

  return parsed;
}
