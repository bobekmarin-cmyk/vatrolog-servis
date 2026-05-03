const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    const ms = await prisma.manufacturer.findMany({
      orderBy: { name: "asc" },
      select: {
        name: true,
        _count: { select: { extinguishers: true, supportedTypes: true } },
      },
    });
    console.log(ms);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

