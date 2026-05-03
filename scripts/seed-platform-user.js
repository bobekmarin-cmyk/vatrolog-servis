/**
 * Jednokratno (ili više puta) osigurava platform vendor korisnika.
 *
 * Lokalno uz produkcijsku bazu:
 *   $env:DATABASE_URL="postgresql://..."   # PowerShell
 *   npm run seed:platform-user
 *
 * Zadano: korisničko ime owner, lozinka owner123 ili SEED_PLATFORM_PASSWORD.
 */
const { PrismaClient, PlatformRole } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("Nedostaje DATABASE_URL.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const password = process.env.SEED_PLATFORM_PASSWORD ?? "owner123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.platformUser.upsert({
    where: { username: "owner" },
    update: { passwordHash, active: true, role: PlatformRole.OWNER },
    create: {
      username: "owner",
      passwordHash,
      active: true,
      role: PlatformRole.OWNER,
    },
  });

  console.log("OK: PlatformUser 'owner' spreman. Lozinka: env SEED_PLATFORM_PASSWORD ili default owner123");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
