/**
 * Multi-account security verification checks.
 *
 * Usage:
 *   npx ts-node -P tsconfig.seed.json scripts/verify-multi-account-security.ts
 */
import { PrismaClient } from "@prisma/client";
import { buildAdminUsername, isValidTenantUsername } from "../src/lib/companyAccountNaming";

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      serviceCode: true,
      usernameSlug: true,
      name: true,
      accounts: {
        select: { id: true, username: true, role: true, active: true },
        orderBy: { username: "asc" },
      },
    },
  });

  let issues = 0;
  for (const c of companies) {
    const admins = c.accounts.filter((a) => a.role === "ADMIN");
    if (admins.length !== 1) {
      issues += 1;
      console.log(`❌ ${c.serviceCode} ${c.name}: očekivan je 1 ADMIN, nađeno ${admins.length}`);
    } else {
      const expected = buildAdminUsername(c.serviceCode, c.usernameSlug);
      if (admins[0].username !== expected) {
        issues += 1;
        console.log(`❌ ${c.serviceCode} ${c.name}: admin username ${admins[0].username} != ${expected}`);
      }
    }

    for (const a of c.accounts.filter((x) => x.role !== "ADMIN")) {
      if (!isValidTenantUsername(a.username)) {
        issues += 1;
        console.log(`❌ ${c.serviceCode} ${c.name}: user username format invalid -> ${a.username}`);
      }
    }
  }

  const inviteLeaks = await prisma.authToken.count({
    where: {
      type: "ACCOUNT_INVITE",
      usedAt: null,
      expiresAt: { lt: new Date() },
    },
  });
  if (inviteLeaks > 0) {
    issues += 1;
    console.log(`❌ Nađeni istekli neiskorišteni invite tokeni: ${inviteLeaks}`);
  }

  if (issues === 0) {
    console.log("✅ Security verification prošao (bez problema).");
  } else {
    console.log(`\nUkupno problema: ${issues}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
