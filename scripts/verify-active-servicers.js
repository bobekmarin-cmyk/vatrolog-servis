const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({ select: { id: true, name: true } });
  for (const c of companies) {
    const users = await prisma.user.findMany({
      where: { companyId: c.id, active: true },
      orderBy: { fullName: "asc" },
      select: { fullName: true, role: true, active: true },
    });
    console.log(`Company ${c.id} (${c.name}):`, users);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

