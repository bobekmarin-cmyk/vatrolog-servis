#!/usr/bin/env node
/**
 * Brza provjera produkcijskog deploya (health, sitemap, robots).
 *
 *   node scripts/smoke-prod-deploy.mjs
 *   node scripts/smoke-prod-deploy.mjs https://vatrolog.com
 */
const base = (process.argv[2] ?? process.env.APP_BASE_URL ?? "https://vatrolog.com").replace(/\/$/, "");

async function check(name, url, validate) {
  const res = await fetch(url, { redirect: "follow" });
  const body = await res.text();
  const err = validate(res, body);
  if (err) {
    console.error(`FAIL  ${name}: ${err} (${res.status} ${url})`);
    return false;
  }
  console.log(`OK    ${name} (${res.status})`);
  return true;
}

let ok = true;

ok =
  (await check(`${base}/api/health`, `${base}/api/health`, (res, body) => {
    if (res.status !== 200) return `expected 200, got ${res.status}`;
    try {
      const j = JSON.parse(body);
      if (!j.ok || !j.db?.ok) return "health JSON missing ok/db.ok";
    } catch {
      return "invalid JSON";
    }
    return null;
  })) && ok;

ok =
  (await check(`${base}/sitemap.xml`, `${base}/sitemap.xml`, (res, body) => {
    if (res.status !== 200) return `expected 200, got ${res.status}`;
    if (body.trimStart().startsWith("<!DOCTYPE html") || body.includes("<html")) {
      return "sitemap is HTML (likely redirect to /login — check middleware matcher)";
    }
    if (!body.includes("<urlset") || !body.includes("<loc>")) return "missing urlset/loc";
    if (!body.includes(`${base}/`) && !body.includes("vatrolog.com")) return "missing site URLs";
    return null;
  })) && ok;

ok =
  (await check(`${base}/robots.txt`, `${base}/robots.txt`, (res, body) => {
    if (res.status !== 200) return `expected 200, got ${res.status}`;
    if (!body.includes("Sitemap:")) return "missing Sitemap: directive";
    if (!body.includes("/legal/")) return "missing /legal/ allow rules";
    return null;
  })) && ok;

if (!ok) process.exit(1);
console.log(`\nProduction smoke OK for ${base}`);
