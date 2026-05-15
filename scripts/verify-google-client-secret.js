/**
 * Verifikacija je li (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) iz .env-a
 * uopce validna kombinacija za Googleov OAuth.
 *
 * Trik: napravimo refresh_token request s OCITO laznim refresh_tokenom.
 *  - Ako je client/secret par OK, Google vraca `invalid_grant` (jer je refresh fake).
 *  - Ako je client/secret par krivi, Google vraca `invalid_client`.
 *
 * Tako diskriminiramo "secret je krivi" od "secret je dobar".
 * Read-only: nista ne mijenja u bazi ni u .env-u.
 */

require("dotenv").config();

const clientId = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

function hexHead(s, n = 5) {
  return Array.from(s.slice(0, n))
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join(" ");
}
function hexTail(s, n = 5) {
  return Array.from(s.slice(-n))
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join(" ");
}

console.log("=== GOOGLE_CLIENT_ID ===");
console.log("  duljina  :", clientId.length);
console.log("  hex head :", hexHead(clientId));
console.log("  hex tail :", hexTail(clientId));
console.log();
console.log("=== GOOGLE_CLIENT_SECRET ===");
console.log("  duljina  :", clientSecret.length);
console.log("  hex head :", hexHead(clientSecret));
console.log("  hex tail :", hexTail(clientSecret));
console.log("  starts with 'GOCSPX-':", clientSecret.startsWith("GOCSPX-"));
console.log();

if (!clientId || !clientSecret) {
  console.error("FAIL: client_id ili client_secret nije postavljen u .env-u.");
  process.exit(2);
}

async function main() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: "verify-secret-only-NOT-A-REAL-TOKEN",
    }),
  });
  const text = await res.text();
  console.log("=== Google response ===");
  console.log("  HTTP status :", res.status);
  console.log("  body        :", text);
  console.log();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { error: "unparsable" };
  }

  if (parsed.error === "invalid_client") {
    console.log("ZAKLJUCAK: SECRET JE KRIVI (ne odgovara client_id-u). Treba rotirati.");
    process.exit(1);
  }
  if (parsed.error === "invalid_grant") {
    console.log("ZAKLJUCAK: SECRET JE DOBAR (Google ga prepoznaje). Greska je negdje drugdje.");
    process.exit(0);
  }
  if (parsed.error === "unauthorized_client") {
    console.log(
      "ZAKLJUCAK: CLIENT TIP NE PODRZAVA refresh_token (vjerojatno nije 'Web application').",
    );
    process.exit(3);
  }
  console.log("ZAKLJUCAK: nepoznat odgovor — pogledaj body iznad.");
  process.exit(4);
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(5);
});
