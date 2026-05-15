#!/usr/bin/env node
/**
 * Restore PostgreSQL baze iz backup-a kreiranog s scripts/backup-db.mjs.
 *
 * Tok:
 *   1) Skini sifriranu .dump.enc iz S3-a (ili koristi lokalnu kopiju)
 *   2) Dekriptiraj s BACKUP_ENCRYPTION_KEY
 *   3) Ispisi .dump na disk i (opcionalno) pokreni pg_restore u ciljnu bazu
 *
 * Tipicni "drill" (mjesecna provjera, na novoj/praznoj test bazi):
 *   RESTORE_TARGET_DATABASE_URL="postgresql://..." \
 *     node scripts/restore-db.mjs --s3-key db-backups/2026/05/14/vatrolog-...dump.enc
 *
 * Bez `--apply` skripta samo dekriptira i ostavi .dump u tmpdir-u (audit-only).
 * S `--apply` se vrti `pg_restore` u `RESTORE_TARGET_DATABASE_URL` (NIKAD nad produkcijom!).
 *
 * Env-i:
 *   BACKUP_ENCRYPTION_KEY     — isti kao kod backup-a
 *   S3_ENDPOINT/REGION/KEY/SECRET — za skidanje iz objekta
 *   S3_BUCKET ili BACKUP_S3_BUCKET
 *   RESTORE_TARGET_DATABASE_URL   — ciljna baza (samo kad se koristi --apply)
 */
import { spawn } from "node:child_process";
import { createDecipheriv } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

function requireEnv(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} nije postavljen.`);
  return v;
}

function parseHexKey(name) {
  const v = requireEnv(name);
  if (!/^[0-9a-f]{64}$/i.test(v)) {
    throw new Error(`${name} mora biti 64 hex znaka (32 bytes).`);
  }
  return Buffer.from(v, "hex");
}

function parseArgs(argv) {
  const out = { s3Key: null, localPath: null, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--s3-key") out.s3Key = argv[++i];
    else if (a === "--local") out.localPath = argv[++i];
    else throw new Error(`Nepoznat argument: ${a}`);
  }
  if (!out.s3Key && !out.localPath) {
    throw new Error("Mora se zadati --s3-key <key> ili --local <path>.");
  }
  return out;
}

async function fetchFromS3(s3Key) {
  const bucket = (process.env.BACKUP_S3_BUCKET || process.env.S3_BUCKET || "").trim();
  if (!bucket) throw new Error("BACKUP_S3_BUCKET ili S3_BUCKET mora biti postavljen.");
  const s3 = new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint: requireEnv("S3_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY"),
    },
  });
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function decryptBuffer(buf, key) {
  if (buf.length < 32) throw new Error("Backup datoteka je prekratka (manje od 32 bytea zaglavlja).");
  const iv = buf.subarray(0, 16);
  const tag = buf.subarray(16, 32);
  const enc = buf.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

async function runPgRestore(targetUrl, dumpPath) {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      "pg_restore",
      ["--dbname", targetUrl, "--no-owner", "--no-acl", "--clean", "--if-exists", dumpPath],
      { stdio: ["ignore", "inherit", "inherit"] },
    );
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`pg_restore exit ${code}`))));
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const key = parseHexKey("BACKUP_ENCRYPTION_KEY");

  let enc;
  let label;
  if (args.s3Key) {
    console.log(`[restore] skidam s3://.../${args.s3Key}`);
    enc = await fetchFromS3(args.s3Key);
    label = basename(args.s3Key);
  } else {
    const { readFile } = await import("node:fs/promises");
    enc = await readFile(args.localPath);
    label = basename(args.localPath);
  }
  console.log(`[restore] sifrirani podaci: ${enc.length} B`);

  const plain = decryptBuffer(enc, key);
  const dumpPath = join(tmpdir(), label.replace(/\.enc$/i, "") || "restored.dump");
  await writeFile(dumpPath, plain);
  console.log(`[restore] dekriptirano i spremljeno → ${dumpPath} (${plain.length} B)`);

  if (!args.apply) {
    console.log("[restore] --apply nije zadano; preskacem pg_restore.");
    console.log(JSON.stringify({ ok: true, dumpPath, applied: false }));
    return;
  }

  const target = requireEnv("RESTORE_TARGET_DATABASE_URL");
  if (target === process.env.DATABASE_URL) {
    throw new Error("RESTORE_TARGET_DATABASE_URL === DATABASE_URL — odbijam restore preko produkcije.");
  }
  console.log(`[restore] pokrecem pg_restore u target bazu`);
  await runPgRestore(target, dumpPath);
  console.log(JSON.stringify({ ok: true, dumpPath, applied: true }));
}

main().catch((err) => {
  console.error(`[restore] FAIL: ${err.message}`);
  process.exit(1);
});
