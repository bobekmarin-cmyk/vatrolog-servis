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
      // 3s socket timeout — ne smije blokirati dashboard ako R2 puknu.
      requestTimeout: 3000,
      connectionTimeout: 3000,
    } as never,
  });
  return { client, bucket };
}

/**
 * Vraca listu zadnjih `limit` backupa (najnoviji prvi). Default 10.
 * Backup pipeline koristi prefix `db-backups/YYYY/MM/DD/...` (vidi scripts/backup-db.mjs).
 */
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
  try {
    const out = await cfg.client.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        // R2 limit je 1000 po requestu; mi želimo zadnje N, sortiramo client-side.
        // Za skromni broj backupa (jedan dnevni) ovo je benigno.
        MaxKeys: Math.max(limit * 4, 50),
      }),
    );
    const all = (out.Contents ?? [])
      .filter((c) => c.Key && c.LastModified)
      .map<BackupObject>((c) => ({
        key: c.Key as string,
        size: c.Size ?? 0,
        lastModified: c.LastModified as Date,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
      .slice(0, Math.max(1, Math.min(limit, 100)));
    return {
      ok: true,
      configured: true,
      prefix,
      bucket: cfg.bucket,
      objects: all,
      errorMessage: null,
    };
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
