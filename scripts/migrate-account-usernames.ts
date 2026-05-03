/**
 * Rename legacy company usernames pre servisnih lokacija (stari self-service / dev):
 *  - {serviceCode}-admin    -> {serviceCode}-{slug}   (slug iz Company.usernameSlug)
 *  - {serviceCode}-workshop -> {serviceCode}-{slug}S
 *
 * Tvrtke bez usernameSlug u bazi bit će preskočene (prvo migracija sheme + backfill).
 *
 * Dry-run by default:
 *   npx ts-node -P tsconfig.seed.json scripts/migrate-account-usernames.ts
 * Apply:
 *   npx ts-node -P tsconfig.seed.json scripts/migrate-account-usernames.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { buildAdminUsername, buildLocationUsername } from "../src/lib/companyAccountNaming";

const prisma = new PrismaClient({ log: ["error", "warn"] });
const APPLY = process.argv.includes("--apply");

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      serviceCode: true,
      usernameSlug: true,
      name: true,
      accounts: {
        select: { id: true, username: true, role: true },
        orderBy: { username: "asc" },
      },
    },
    orderBy: { serviceCode: "asc" },
  });

  const actions: Array<{ accountId: string; from: string; to: string; company: string }> = [];

  for (const c of companies) {
    if (!c.usernameSlug) continue;
    const adminOld = `${c.serviceCode}-admin`;
    const workshopOld = `${c.serviceCode}-workshop`;
    for (const a of c.accounts) {
      if (a.username === adminOld || a.username === "admin") {
        actions.push({
          accountId: a.id,
          from: a.username,
          to: buildAdminUsername(c.serviceCode, c.usernameSlug),
          company: `${c.serviceCode} (${c.name})`,
        });
      } else if (a.username === workshopOld || a.username === "workshop") {
        actions.push({
          accountId: a.id,
          from: a.username,
          to: buildLocationUsername(c.serviceCode, c.usernameSlug, "STATIONARY", 1),
          company: `${c.serviceCode} (${c.name})`,
        });
      }
    }
  }

  console.log(`Pronađeno preimenovanja: ${actions.length}`);
  for (const a of actions) {
    console.log(` - ${a.company}: ${a.from} -> ${a.to}`);
  }

  if (!APPLY) {
    console.log("Dry-run završen. Dodaj --apply za izvršenje.");
    return;
  }

  for (const a of actions) {
    await prisma.accountUser.update({
      where: { id: a.accountId },
      data: { username: a.to },
    });
  }

  console.log(`Primijenjeno: ${actions.length}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
