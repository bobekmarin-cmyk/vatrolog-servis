import fs from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logInfo, logWarn } from "@/lib/logger";

/**
 * PDF storage abstrakcija.
 *
 * Strategija:
 *  - Ako su postavljeni S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY + S3_BUCKET,
 *    koristi S3-kompatibilni storage (Cloudflare R2, Backblaze B2, AWS S3, MinIO).
 *  - Inače fallback na lokalni filesystem (dev / single-server deploy).
 *
 * Putanja u storageu: `pdf/{companyId}/{docType}/{safe-order-number}.pdf`
 */

const PDF_DIR = path.join(process.cwd(), "storage", "pdf");

type StorageMode = "s3" | "local";

let cachedMode: StorageMode | null = null;
let s3Client: S3Client | null = null;

function getMode(): StorageMode {
  if (cachedMode) return cachedMode;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET?.trim();
  const ak = process.env.S3_ACCESS_KEY?.trim();
  const sk = process.env.S3_SECRET_KEY?.trim();
  if (endpoint && bucket && ak && sk) {
    cachedMode = "s3";
    logInfo("pdf_storage_mode", { mode: "s3", endpoint, bucket });
    return "s3";
  }
  cachedMode = "local";
  return "local";
}

function getS3(): S3Client {
  if (s3Client) return s3Client;
  s3Client = new S3Client({
    region: process.env.S3_REGION?.trim() ?? "auto",
    endpoint: process.env.S3_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
  return s3Client;
}

function s3Key(companyId: string, docType: string, orderNumber: string, ext = "pdf"): string {
  const safe = orderNumber.replaceAll("/", "-");
  return `pdf/${companyId}/${docType}/${docType}_${safe}.${ext}`;
}

export type PdfDocType = "register" | "delivery-note" | "invoice" | "receipt";

/**
 * Spremi PDF. Vraća putanju (lokalni path ili S3 key) koja se sprema u DB.
 */
export async function savePdf(
  companyId: string,
  docType: PdfDocType,
  orderNumber: string,
  buffer: Buffer | Uint8Array,
): Promise<string> {
  const mode = getMode();

  if (mode === "s3") {
    const Key = s3Key(companyId, docType, orderNumber);
    const Bucket = process.env.S3_BUCKET!;
    try {
      const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
      await getS3().send(
        new PutObjectCommand({
          Bucket,
          Key,
          Body: body,
          ContentType: "application/pdf",
        }),
      );
      return `s3://${Bucket}/${Key}`;
    } catch (err) {
      // U produkciji NE radimo silent fallback na lokalni filesystem — to bi
      // bilo skrivanje degradacije i potencijalno cross-tenant curenje
      // dokumenata na zajedničkom hostu. Greška se eskaliuje pozivatelju.
      if (process.env.NODE_ENV === "production") {
        throw new Error(`PDF S3 upload nije uspio (${String(err)}). Pozivatelj treba retry.`);
      }
      logWarn("pdf_s3_upload_failed_fallback_local", { Key, err: String(err) });
      // Dev fallback na lokalni filesystem nastavlja niže.
    }
  } else if (process.env.NODE_ENV === "production") {
    // S3 uopće nije konfiguriran u produkciji — nema sigurnog fallbacka.
    throw new Error(
      "PDF storage nije konfiguriran (S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY). " +
        "U produkciji je obavezan S3-kompatibilni storage.",
    );
  }

  const dir = path.join(PDF_DIR, companyId, docType);
  await fs.mkdir(dir, { recursive: true });
  const safeName = orderNumber.replaceAll("/", "-");
  const filename = `${docType}_${safeName}.pdf`;
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

/**
 * Dohvati PDF. Prihvaća lokalnu putanju (legacy), s3://, ili file:// URL.
 */
export async function readPdf(pathOrUrl: string): Promise<Buffer> {
  if (pathOrUrl.startsWith("s3://")) {
    const withoutScheme = pathOrUrl.slice("s3://".length);
    const slashIdx = withoutScheme.indexOf("/");
    const Bucket = withoutScheme.slice(0, slashIdx);
    const Key = withoutScheme.slice(slashIdx + 1);
    const res = await getS3().send(new GetObjectCommand({ Bucket, Key }));
    const chunks: Buffer[] = [];
    const stream = res.Body as AsyncIterable<Uint8Array>;
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  return fs.readFile(pathOrUrl);
}

/**
 * Generira privremeni signed URL za download (S3 mode); za lokalni mode vraća null
 * (treba koristiti direktni download kroz API rutu).
 */
export async function getPdfSignedUrl(pathOrUrl: string, expiresInSec = 60 * 10): Promise<string | null> {
  if (!pathOrUrl.startsWith("s3://")) return null;
  const withoutScheme = pathOrUrl.slice("s3://".length);
  const slashIdx = withoutScheme.indexOf("/");
  const Bucket = withoutScheme.slice(0, slashIdx);
  const Key = withoutScheme.slice(slashIdx + 1);
  const cmd = new GetObjectCommand({ Bucket, Key });
  return await getSignedUrl(getS3(), cmd, { expiresIn: expiresInSec });
}

/** True ako koristimo S3 (za conditional UI). */
export function isS3Configured(): boolean {
  return getMode() === "s3";
}
