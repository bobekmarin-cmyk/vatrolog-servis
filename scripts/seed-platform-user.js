/**
 * Jednokratno (ili više puta) osigurava platform vendor korisnika.
 *
 * Lokalno uz produkcijsku bazu:
 *   $env:DATABASE_URL="postgresql://..."   # PowerShell
 *   $env:SEED_PLATFORM_EMAIL="tvoj@gmail.com"  # opcionalno, za Google prijavu
 *   npm run seed:platform-user
 *
 * Zadano: korisničko ime owner, lozinka owner123 ili SEED_PLATFORM_PASSWORD.
 * Ako je postavljen SEED_PLATFORM_EMAIL, postavlja se i email (potreban za
 * prvu Google prijavu — mapiranje po emailu prije nego se veze `googleSub`).
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
  const emailRaw = process.env.SEED_PLATFORM_EMAIL?.trim().toLowerCase();
  const email = emailRaw && emailRaw.includes("@") ? emailRaw : null;

  await prisma.platformUser.upsert({
    where: { username: "owner" },
    update: {
      passwordHash,
      active: true,
      role: PlatformRole.OWNER,
      ...(email ? { email } : {}),
    },
    create: {
      username: "owner",
      passwordHash,
      active: true,
      role: PlatformRole.OWNER,
      email,
    },
  });

  console.log(
    `OK: PlatformUser 'owner' spreman. Lozinka: env SEED_PLATFORM_PASSWORD ili default owner123${
      email ? `, email: ${email}` : " (email nije postavljen — Google prijava nece moci napraviti prvi match)"
    }`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
