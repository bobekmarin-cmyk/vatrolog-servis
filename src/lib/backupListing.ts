/**
 * Read-only listanje backup objekata iz S3/R2 bucketa.
 *
 * Koristi se samo na platform sucelju (vendor); ne smije se izlagati tenantima.
 * Defenzivno: nikad ne baca; ako lista nije dostupna (env fali, mreza, ACL...),
 * vraca prazan niz + last error tekstualno.
 */
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export type BackupObject = {
  key: string;
  size: number;
  lastModified: Date;
};

export type BackupListing = {
  ok: boolean;
  configured: boolean;
  prefix: string;
  bucket: string | null;
  objects: BackupObject[];
  errorMessage: string | null;
};

function getClient(): { client: S3Client; bucket: string } | null {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = (
    process.env.BACKUP_S3_BUCKET?.trim() ||
    process.env.S3_BUCKET?.trim() ||
    ""
  ).trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 2,
    requestHandler: {
      requestTimeout: 8000,
      connectionTimeout: 5000,
    } as never,
  });
  return { client, bucket };
}

/** Prefixi db-backups/YYYY/MM/ — unatrag od trenutnog UTC mjeseca. */
function backupMonthPrefixes(monthsBack: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < monthsBack; i++) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    out.push(`db-backups/${y}/${m}/`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

async function listAllUnderPrefix(
  client: S3Client,
  bucket: string,
  prefix: string,
): Promise<BackupObject[]> {
  const objects: BackupObject[] = [];
  let continuationToken: string | undefined;
  let pages = 0;
  const maxPages = 20;

  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );
    for (const c of out.Contents ?? []) {
      if (c.Key && c.LastModified && !c.Key.endsWith("/")) {
        objects.push({
          key: c.Key,
          size: c.Size ?? 0,
          lastModified: c.LastModified,
        });
      }
    }
    if (!out.IsTruncated) break;
    continuationToken = out.NextContinuationToken;
    pages++;
  } while (continuationToken && pages < maxPages);

  return objects;
}

function sortAndSlice(objects: BackupObject[], limit: number): BackupObject[] {
  return objects
    .slice()
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, Math.max(1, Math.min(limit, 100)));
}

/**
 * Vraca listu zadnjih `limit` backupa (najnoviji prvi). Default 10.
 * Backup pipeline koristi prefix `db-backups/YYYY/MM/DD/...` (vidi scripts/backup-db.mjs).
 *
 * R2/S3 ListObjectsV2 vraca kljuceve leksikografski i po stranicama (max 1000).
 * Stari kod je uzeo samo prvu stranicu (~50 kljuceva) pa je „najnoviji“ backup
 * bio zastario cim je u bucketu bilo vise od ~50 datoteka. Sada listamo po
 * mjesecima unatrag (najprije trenutni) s punom paginacijom po prefixu.
 */
/**
 * Broj mjeseci unatrag koje pretražujemo prije nego padnemo na full-bucket list.
 * Prazan bucket je prije značio 18 uzastopnih ListObjectsV2 poziva u renderu
 * platform dashboarda — to je bila glavna komponenta latencije te stranice.
 */
const MONTHS_BACK = 2;

/** Kratki in-memory cache — dashboard i health stranica ne trebaju svjež S3 list na svaki render. */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; limit: number; value: BackupListing } | null = null;

export async function listRecentBackups(limit = 10): Promise<BackupListing> {
  const prefix = "db-backups/";
  const cfg = getClient();
  if (!cfg) {
    return {
      ok: false,
      configured: false,
      prefix,
      bucket: null,
      objects: [],
      errorMessage: "S3 (BACKUP_S3_BUCKET ili S3_BUCKET + S3_ACCESS_KEY/SECRET) nije konfiguriran.",
    };
  }

  const need = Math.max(1, Math.min(limit, 100));
  if (cache && cache.limit >= need && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.value, objects: cache.value.objects.slice(0, need) };
  }

  try {
    let merged: BackupObject[] = [];

    for (const monthPrefix of backupMonthPrefixes(MONTHS_BACK)) {
      const batch = await listAllUnderPrefix(cfg.client, cfg.bucket, monthPrefix);
      if (batch.length === 0) continue;
      merged = sortAndSlice([...merged, ...batch], need);
      if (merged.length >= need) break;
    }

    if (merged.length === 0) {
      merged = sortAndSlice(await listAllUnderPrefix(cfg.client, cfg.bucket, prefix), need);
    }

    const value: BackupListing = {
      ok: true,
      configured: true,
      prefix,
      bucket: cfg.bucket,
      objects: merged,
      errorMessage: null,
    };
    cache = { at: Date.now(), limit: need, value };
    return value;
  } catch (err) {
    return {
      ok: false,
      configured: true,
      prefix,
      bucket: cfg.bucket,
      objects: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Konvertira bytes u "12.3 kB" / "4.5 MB" za human display. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
