#!/usr/bin/env node
/**
 * Backup PostgreSQL baze na vise destinacija (S3-kompatibilno + Google Drive).
 *
 * Tok:
 *   1) pg_dump --format=custom protiv DATABASE_URL  →  privremena .dump datoteka
 *   2) AES-256-GCM enkripcija s BACKUP_ENCRYPTION_KEY  →  .dump.enc
 *   3) Upload .enc na S3 (BACKUP_S3_BUCKET ili S3_BUCKET)
 *   4) (opcionalno) Upload .enc na Google Drive preko service accounta
 *   5) Brisanje privremenih datoteka
 *
 * Format enkripcije: [16 IV][16 GCM tag][ciphertext]  (vidi scripts/restore-db.mjs)
 *
 * Obavezno (Railway/CI/lokalni):
 *   DATABASE_URL           — PostgreSQL connection string
 *   BACKUP_ENCRYPTION_KEY  — 64 hex znaka (32 bytes) → openssl rand -hex 32
 *   S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
 *   S3_BUCKET ili BACKUP_S3_BUCKET
 *
 * Opcionalno (Google Drive sekundar):
 *   GOOGLE_DRIVE_SA_JSON   — sadrzaj service account JSON kljuca (jedan red)
 *   GOOGLE_DRIVE_FOLDER_ID — ID Drive mape (mora biti shared sa SA emailom)
 *
 * Sistem: zahtijeva `pg_dump` u PATH-u (ubuntu-latest GH runner ga ima).
 *
 * Pokretanje:
 *   node scripts/backup-db.mjs
 */
import { spawn } from "node:child_process";
import { createCipheriv, randomBytes } from "node:crypto";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { SignJWT, importPKCS8 } from "jose";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} nije postavljen.`);
  return v;
}

/**
 * Backup se vrti na GitHub Actions runneru, izvan Railway mreze. Railwayev
 * privatni host (`*.railway.internal`) se odande ne moze razrijesiti, pa
 * `pg_dump` padne s nejasnom DNS greskom. Radije to uhvatimo odmah i kazemo
 * tocno sto treba promijeniti.
 */
function requireExternallyReachableDatabaseUrl() {
  const url = requireEnv("DATABASE_URL");
  if (url.includes(".railway.internal")) {
    throw new Error(
      "DATABASE_URL pokazuje na Railwayev privatni host (*.railway.internal), " +
        "koji je dostupan samo unutar Railwaya. Za backup iz GitHub Actionsa treba " +
        "javni URL: Railway -> Postgres -> Variables -> DATABASE_PUBLIC_URL " +
        "(oblik postgresql://...@*.proxy.rlwy.net:PORT/railway). " +
        "Zamijeni GitHub secret Settings -> Secrets and variables -> Actions -> DATABASE_URL.",
    );
  }
  return url;
}

function parseHexKey(name) {
  const v = requireEnv(name);
  if (!/^[0-9a-f]{64}$/i.test(v)) {
    throw new Error(`${name} mora biti 64 hex znaka (32 bytes). Generiraj s "openssl rand -hex 32".`);
  }
  return Buffer.from(v, "hex");
}

async function runPgDump(targetPath) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      "pg_dump",
      [
        requireExternallyReachableDatabaseUrl(),
        "--format=custom",
        "--no-owner",
        "--no-acl",
        "--file",
        targetPath,
      ],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`pg_dump nije uspio (code=${code} signal=${signal}).`));
    });
  });
}

function encryptBuffer(plain, key) {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

async function getDriveAccessToken() {
  const raw = process.env.GOOGLE_DRIVE_SA_JSON?.trim();
  if (!raw) return null;
  const sa = JSON.parse(raw);
  if (!sa.client_email || !sa.private_key) {
    throw new Error("GOOGLE_DRIVE_SA_JSON ne sadrzi client_email/private_key.");
  }
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: DRIVE_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange nije uspio: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.access_token;
}

async function uploadToDrive({ token, parentId, name, data }) {
  const metadata = { name, parents: parentId ? [parentId] : undefined };
  const boundary = `vatrolog-${Date.now()}-${randomBytes(6).toString("hex")}`;
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, data, tail]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Drive upload nije uspio: ${res.status} ${await res.text()}`);
  }
  return await res.json();
}

function nowParts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return {
    year: d.getUTCFullYear().toString(),
    month: pad(d.getUTCMonth() + 1),
    day: pad(d.getUTCDate()),
    hhmm: `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`,
    iso: d.toISOString(),
  };
}

async function main() {
  const key = parseHexKey("BACKUP_ENCRYPTION_KEY");
  const bucket = (process.env.BACKUP_S3_BUCKET || process.env.S3_BUCKET || "").trim();
  if (!bucket) throw new Error("BACKUP_S3_BUCKET ili S3_BUCKET mora biti postavljen.");

  const stamp = nowParts();
  const filename = `vatrolog-${stamp.year}${stamp.month}${stamp.day}-${stamp.hhmm}.dump.enc`;
  const s3Key = `db-backups/${stamp.year}/${stamp.month}/${stamp.day}/${filename}`;
  const dumpPath = join(tmpdir(), `${filename.replace(".enc", "")}`);

  console.log(`[backup] pg_dump → ${dumpPath}`);
  await runPgDump(dumpPath);
  const plain = await readFile(dumpPath);
  console.log(`[backup] dump size: ${plain.length} B (${(plain.length / 1024 / 1024).toFixed(1)} MB)`);

  const encrypted = encryptBuffer(plain, key);
  console.log(`[backup] encrypted size: ${encrypted.length} B`);

  const s3 = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint: requireEnv("S3_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY"),
    },
  });
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: encrypted,
      ContentType: "application/octet-stream",
      Metadata: {
        source: "scripts/backup-db.mjs",
        createdAt: stamp.iso,
      },
    }),
  );
  console.log(`[backup] S3 upload OK → s3://${bucket}/${s3Key}`);

  let driveResult = null;
  try {
    const token = await getDriveAccessToken();
    if (token) {
      driveResult = await uploadToDrive({
        token,
        parentId: process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null,
        name: filename,
        data: encrypted,
      });
      console.log(`[backup] Drive upload OK → fileId=${driveResult.id}`);
    } else {
      console.log("[backup] Google Drive nije konfiguriran — preskačem sekundarnu kopiju.");
    }
  } catch (e) {
    // Greska na Drive uploadu ne smije srusiti backup (S3 je primarni).
    console.error(`[backup] Drive upload nije uspio: ${e.message}`);
    process.exitCode = 2;
  }

  try {
    await unlink(dumpPath);
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify({
      ok: true,
      s3Key,
      driveFileId: driveResult?.id ?? null,
      bytes: encrypted.length,
      at: stamp.iso,
    }),
  );
}

main().catch((err) => {
  console.error(`[backup] FAIL: ${err.message}`);
  process.exit(1);
});
