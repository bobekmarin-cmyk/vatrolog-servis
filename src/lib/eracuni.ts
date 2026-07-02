import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/gmail";

/**
 * Klijent za e-racuni.com (eurofaktura) Web Services API.
 *
 * Sve metode idu kao POST JSON na HR endpoint. Autentikacija: username +
 * secretKey (API password) + token organizacije. Kredencijali su AES-256-GCM
 * šifrirani u CompanyERacuniSettings.
 *
 * Napomena o odgovorima: JSON API zrcali XML strukturu (<response status="ok">),
 * pa parsiramo defenzivno — točan oblik polja može varirati po metodi.
 */

const ERACUNI_API_URL = "https://e-racuni.com/WebServicesHR/API";

export type ERacuniCredentials = {
  username: string;
  secretKey: string;
  token: string;
};

export type ERacuniSettingsResolved = {
  id: string;
  enabled: boolean;
  credentials: ERacuniCredentials | null;
  paymentMethod: string;
  paymentDueDays: number;
  labelKompletCode: string | null;
  labelKompletName: string;
  labelKompletPrice: number | null;
  lastTestOkAt: Date | null;
};

export class ERacuniError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ERacuniError";
  }
}

export function encryptSecret(plain: string): string {
  return encryptToken(plain);
}

export async function getERacuniSettings(companyId: string): Promise<ERacuniSettingsResolved | null> {
  const row = await prisma.companyERacuniSettings.findUnique({ where: { companyId } });
  if (!row) return null;

  let credentials: ERacuniCredentials | null = null;
  if (row.apiUsername && row.apiPasswordEnc && row.apiTokenEnc) {
    try {
      credentials = {
        username: row.apiUsername,
        secretKey: decryptToken(row.apiPasswordEnc),
        token: decryptToken(row.apiTokenEnc),
      };
    } catch {
      credentials = null;
    }
  }

  return {
    id: row.id,
    enabled: row.enabled,
    credentials,
    paymentMethod: row.paymentMethod,
    paymentDueDays: row.paymentDueDays,
    labelKompletCode: row.labelKompletCode,
    labelKompletName: row.labelKompletName,
    labelKompletPrice: row.labelKompletPrice ? Number(row.labelKompletPrice) : null,
    lastTestOkAt: row.lastTestOkAt,
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractErrorMessage(data: unknown): string {
  if (!isRecord(data)) return "Nepoznata greška e-računi API-ja.";
  for (const key of ["error", "errorMessage", "message", "errorDescription"]) {
    const v = data[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (isRecord(v)) {
      const inner = extractErrorMessage(v);
      if (inner !== "Nepoznata greška e-računi API-ja.") return inner;
    }
  }
  const resp = data["response"];
  if (isRecord(resp)) return extractErrorMessage(resp);
  return "Nepoznata greška e-računi API-ja.";
}

function responseStatus(data: unknown): string | null {
  if (!isRecord(data)) return null;
  const direct = data["status"];
  if (typeof direct === "string") return direct;
  const resp = data["response"];
  if (isRecord(resp) && typeof resp["status"] === "string") return resp["status"] as string;
  return null;
}

/** Payload odgovora bez omotača ("response" ako postoji). */
function responseBody(data: unknown): JsonRecord {
  if (!isRecord(data)) return {};
  const resp = data["response"];
  return isRecord(resp) ? resp : data;
}

export async function eracuniCall(
  creds: ERacuniCredentials,
  method: string,
  parameters: JsonRecord,
): Promise<JsonRecord> {
  let res: Response;
  try {
    res = await fetch(ERACUNI_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: creds.username,
        secretKey: creds.secretKey,
        token: creds.token,
        method,
        parameters,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new ERacuniError(
      `Ne mogu se spojiti na e-računi API (${e instanceof Error ? e.message : "mrežna greška"}).`,
    );
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ERacuniError(
      `Neočekivan odgovor e-računi API-ja (HTTP ${res.status}): ${text.slice(0, 300)}`,
    );
  }

  if (!res.ok) {
    throw new ERacuniError(`e-računi API HTTP ${res.status}: ${extractErrorMessage(data)}`);
  }

  const status = responseStatus(data);
  if (status && status.toLowerCase() !== "ok") {
    throw new ERacuniError(extractErrorMessage(data));
  }

  return responseBody(data);
}

/** Provjera veze: lagani poziv koji ne mijenja podatke. */
export async function testERacuniConnection(creds: ERacuniCredentials): Promise<void> {
  // PartnerList s neplauzibilnim OIB-om — očekujemo OK odgovor s praznom listom.
  await eracuniCall(creds, "PartnerList", { personalID: "00000000000" });
}

export type ERacuniPartner = {
  code: string | null;
  name: string | null;
};

function firstArrayDeep(v: unknown, depth = 0): unknown[] | null {
  if (depth > 3) return null;
  if (Array.isArray(v)) return v;
  if (!isRecord(v)) return null;
  for (const val of Object.values(v)) {
    const arr = firstArrayDeep(val, depth + 1);
    if (arr) return arr;
  }
  return null;
}

function readString(rec: JsonRecord, keys: string[]): string | null {
  for (const k of keys) {
    const v = rec[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

/** Nađi partnera po OIB-u. Vraća null ako ne postoji. */
export async function findPartnerByOib(
  creds: ERacuniCredentials,
  oib: string,
): Promise<ERacuniPartner | null> {
  const body = await eracuniCall(creds, "PartnerList", { personalID: oib });
  const arr = firstArrayDeep(body);
  if (!arr || arr.length === 0) return null;

  for (const entry of arr) {
    if (!isRecord(entry)) continue;
    const pid = readString(entry, ["personalID", "taxNumber", "oib"]);
    // Ako lista vraća više zapisa, uzmi onaj s točnim OIB-om; ako polja nema, uzmi prvi.
    if (pid === null || pid === oib) {
      return {
        code: readString(entry, ["code", "partnerCode"]),
        name: readString(entry, ["name", "companyName"]),
      };
    }
  }
  return null;
}

export type PartnerCreateInput = {
  oib: string;
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * Osiguraj partnera u e-računima: ako postoji po OIB-u koristi ga (bez izmjena),
 * inače ga kreiraj s podacima iz VatroLoga.
 */
export async function ensurePartner(
  creds: ERacuniCredentials,
  input: PartnerCreateInput,
): Promise<ERacuniPartner> {
  const existing = await findPartnerByOib(creds, input.oib);
  if (existing) return existing;

  await eracuniCall(creds, "PartnerCreate", {
    partner: {
      name: input.name,
      personalID: input.oib,
      taxNumber: `HR${input.oib}`,
      subjectType: "Organization",
      Addresses: [
        {
          addressType: "Primary",
          street: input.street ?? "",
          postalCode: input.postalCode ?? "",
          city: input.city ?? "",
          country: "HR",
          eMail: input.email ?? "",
          phoneNumber: input.phone ?? "",
        },
      ],
    },
  });

  const created = await findPartnerByOib(creds, input.oib);
  return created ?? { code: null, name: input.name };
}

export type InvoiceLine = {
  code: string | null;
  description: string;
  quantity: number;
  unit: string;
  /** Neto cijena (bez PDV-a) po jedinici. */
  netPrice: number;
  /** Rabat u postocima (0–100). */
  discountPercentage: number;
};

export type CreateDraftInvoiceInput = {
  buyer: {
    partnerCode: string | null;
    name: string;
    oib: string;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    email: string | null;
  };
  /** Datum isporuke/usluge (obično datum zaključavanja naloga). */
  dateOfSupply: Date;
  paymentMethod: string;
  paymentDueDays: number;
  lines: InvoiceLine[];
  /** Npr. "Veza: otpremnica 10-260001, radni nalog 0019/2026". */
  remark: string | null;
  /** Idempotencija — isti ID nikad ne kreira drugi dokument. */
  apiTransactionId: string;
};

export type CreatedInvoice = {
  documentId: string | null;
  number: string | null;
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function createDraftInvoice(
  creds: ERacuniCredentials,
  input: CreateDraftInvoiceInput,
): Promise<CreatedInvoice> {
  const now = new Date();
  const due = new Date(now.getTime() + input.paymentDueDays * 24 * 60 * 60 * 1000);

  const invoice: JsonRecord = {
    status: "draft",
    date: isoDate(now),
    dateOfSupplyFrom: isoDate(input.dateOfSupply),
    dateOfSupplyUntil: isoDate(input.dateOfSupply),
    expirationDate: isoDate(due),
    methodOfPayment: input.paymentMethod,
    buyerName: input.buyer.name,
    buyerTaxNumber: `HR${input.buyer.oib}`,
    buyerStreet: input.buyer.street ?? "",
    buyerPostalCode: input.buyer.postalCode ?? "",
    buyerCity: input.buyer.city ?? "",
    buyerCountry: "HR",
    ...(input.buyer.email ? { buyerEMail: input.buyer.email } : {}),
    ...(input.buyer.partnerCode ? { buyerCode: input.buyer.partnerCode } : {}),
    ...(input.remark ? { remark: input.remark } : {}),
    Items: input.lines.map((l) => ({
      ...(l.code ? { productCode: l.code } : {}),
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      netPrice: l.netPrice,
      ...(l.discountPercentage > 0 ? { discountPercentage: l.discountPercentage } : {}),
    })),
  };

  const body = await eracuniCall(creds, "SalesInvoiceCreate", {
    SalesInvoice: invoice,
    apiTransactionId: input.apiTransactionId,
  });

  return {
    documentId: readString(body, ["documentID", "documentId", "id"]),
    number: readString(body, ["number", "invoiceNumber", "docNumber"]),
  };
}

export type InvoiceStatusInfo = {
  raw: string | null;
  issued: boolean;
  number: string | null;
};

export async function getInvoiceStatus(
  creds: ERacuniCredentials,
  documentId: string,
): Promise<InvoiceStatusInfo> {
  const body = await eracuniCall(creds, "SalesInvoiceGet", { documentID: documentId });

  // Status i broj mogu biti na vrhu ili unutar ugniježđenog objekta računa.
  let statusStr = readString(body, ["status", "documentStatus", "invoiceStatus"]);
  let number = readString(body, ["number", "invoiceNumber", "docNumber"]);
  if (!statusStr || !number) {
    for (const v of Object.values(body)) {
      if (!isRecord(v)) continue;
      statusStr = statusStr ?? readString(v, ["status", "documentStatus", "invoiceStatus"]);
      number = number ?? readString(v, ["number", "invoiceNumber", "docNumber"]);
    }
  }

  const normalized = (statusStr ?? "").toLowerCase();
  // "draft" = koncept; sve varijante "issued*" / "paid" / "sent" znače izdan.
  const issued =
    normalized.length > 0 &&
    normalized !== "draft" &&
    (normalized.includes("issued") || normalized === "paid" || normalized === "sent");

  return { raw: statusStr, issued, number };
}

function findBase64Deep(v: unknown, depth = 0): string | null {
  if (depth > 3) return null;
  if (typeof v === "string") {
    const s = v.trim();
    // PDF u Base64: počinje s "JVBERi" (= "%PDF") i dovoljno je dug.
    if (s.length > 500 && s.startsWith("JVBERi")) return s;
    return null;
  }
  if (Array.isArray(v)) {
    for (const item of v) {
      const found = findBase64Deep(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isRecord(v)) {
    for (const key of ["pdf", "file", "content", "data", "document"]) {
      const found = findBase64Deep(v[key], depth + 1);
      if (found) return found;
    }
    for (const val of Object.values(v)) {
      const found = findBase64Deep(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export async function getInvoicePdf(
  creds: ERacuniCredentials,
  documentId: string,
): Promise<Buffer> {
  const body = await eracuniCall(creds, "SalesInvoiceGetPDF", { documentID: documentId });
  const b64 = findBase64Deep(body);
  if (!b64) {
    throw new ERacuniError("e-računi nije vratio PDF računa (Base64 sadržaj nije pronađen).");
  }
  return Buffer.from(b64, "base64");
}
