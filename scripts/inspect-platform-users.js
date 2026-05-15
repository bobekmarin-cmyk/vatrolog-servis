/**
 * Pomocna inspekcija PlatformUser zapisa + provjera da Google polja postoje.
 * Read-only.
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const cols = await prisma.$queryRawUnsafe(
    "SELECT column_name FROM information_schema.columns WHERE table_name='PlatformUser' ORDER BY column_name",
  );
  console.log("Kolone u PlatformUser:");
  for (const c of cols) console.log("  -", c.column_name);

  const users = await prisma.platformUser.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      googleSub: true,
      active: true,
      role: true,
      lastGoogleLoginAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  console.log("\nPlatformUser zapisi:");
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
