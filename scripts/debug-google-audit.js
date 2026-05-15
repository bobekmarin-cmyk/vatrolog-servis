const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.auditLog.findMany({
    where: { action: { startsWith: "platform.googleLogin." } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  for (const r of rows) {
    console.log("---");
    console.log("when    :", r.createdAt.toISOString());
    console.log("action  :", r.action);
    console.log("ip      :", r.ip);
    console.log("meta    :", JSON.stringify(r.meta));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
