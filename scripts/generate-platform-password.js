/**
 * Generira jaku lozinku za fallback platform usera + bcrypt hash spreman za INSERT/UPDATE.
 * Lozinka se ISPISUJE jednom — odmah je spremi u password manager (1Password / Bitwarden).
 *
 * Uporaba:
 *   node scripts/generate-platform-password.js [length]
 *
 * Default length = 32 chars (URL-safe random — slova, brojevi, neki znakovi).
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function randomPassword(length) {
  const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const DIGITS = "0123456789";
  const SYM = "!@#$%^&*-_+="; // dovoljno tipkovnice friendly
  const POOL = ALPHA + DIGITS + SYM;
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += POOL[bytes[i] % POOL.length];
  return out;
}

async function main() {
  const len = Math.max(20, parseInt(process.argv[2] ?? "32", 10) || 32);
  const password = randomPassword(len);
  const hash = await bcrypt.hash(password, 12);

  console.log("=== NOVA PLATFORM LOZINKA ===");
  console.log("");
  console.log("Lozinka (SPREMI ODMAH U PASSWORD MANAGER, vise nece biti prikazana):");
  console.log("  " + password);
  console.log("");
  console.log("Duljina:", password.length, "znakova");
  console.log("Bcrypt hash (cost=12):");
  console.log("  " + hash);
  console.log("");
  console.log("SQL UPDATE primjer (Railway DB Query tab):");
  console.log(`  UPDATE "PlatformUser"`);
  console.log(`  SET username = 'NEW_USERNAME_OVDJE',`);
  console.log(`      "passwordHash" = '${hash}',`);
  console.log(`      "updatedAt" = NOW()`);
  console.log(`  WHERE username = 'owner';`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
