/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const KEEP_NAMES = ["Marin Bobek", "Tomislav Bobek", "Tomica Sedlar"];

async function main() {
  const companyCount = await prisma.company.count();

  // Determine target companyIds:
  // 1) prefer companies that already have at least one of the keep names
  // 2) if none, but only one company exists, use it
  const candidateCompanyIds = await prisma.user
    .findMany({
      where: { fullName: { in: KEEP_NAMES } },
      select: { companyId: true },
    })
    .then((rows) => Array.from(new Set(rows.map((r) => r.companyId).filter(Boolean))));

  let targetCompanyIds = candidateCompanyIds;

  if (targetCompanyIds.length === 0) {
    if (companyCount === 1) {
      const only = await prisma.company.findFirst({ select: { id: true } });
      targetCompanyIds = only ? [only.id] : [];
    }
  }

  if (targetCompanyIds.length === 0) {
    throw new Error(
      "Ne mogu odrediti tvrtku za cleanup (nema serviserâ s ciljanim imenima i postoji više tvrtki)."
    );
  }

  console.log("Cleaning servicers for companies:", targetCompanyIds.join(", "));

  for (const companyId of targetCompanyIds) {
    console.log("Company:", companyId);

    // Ensure keep users exist
    for (const name of KEEP_NAMES) {
      const existing = await prisma.user.findFirst({
        where: { companyId, fullName: name },
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (!existing) {
        await prisma.user.create({
          data: {
            companyId,
            fullName: name,
            role: "SERVISER",
            active: true,
          },
        });
        console.log("  created:", name);
      }
    }

    // Deduplicate keep names: keep one per name, re-point references, delete duplicates
    for (const name of KEEP_NAMES) {
      const all = await prisma.user.findMany({
        where: { companyId, fullName: name },
        orderBy: [{ active: "desc" }, { createdAt: "asc" }],
        select: { id: true, active: true },
      });
      const keep = all[0];
      const dups = all.slice(1);
      if (!keep) continue;

      // Make sure kept is active
      await prisma.user.update({ where: { id: keep.id }, data: { active: true, role: "SERVISER" } });

      if (dups.length > 0) {
        const dupIds = dups.map((u) => u.id);
        await prisma.workOrderItem.updateMany({
          where: { companyId, servicerId: { in: dupIds } },
          data: { servicerId: keep.id },
        });
        await prisma.workOrder.updateMany({
          where: { companyId, lockedById: { in: dupIds } },
          data: { lockedById: keep.id },
        });
        await prisma.user.deleteMany({ where: { id: { in: dupIds } } });
        console.log("  dedup:", name, "deleted", dups.length);
      }
    }

    const keepUsers = await prisma.user.findMany({
      where: { companyId, fullName: { in: KEEP_NAMES } },
      select: { id: true },
    });
    const keepIds = new Set(keepUsers.map((u) => u.id));

    const others = await prisma.user.findMany({
      where: { companyId, id: { notIn: Array.from(keepIds) } },
      select: { id: true, fullName: true },
    });

    for (const u of others) {
      const usedServicer = await prisma.workOrderItem.count({ where: { companyId, servicerId: u.id } });
      const usedLockedBy = await prisma.workOrder.count({ where: { companyId, lockedById: u.id } });
      const used = usedServicer + usedLockedBy;

      if (used > 0) {
        await prisma.user.update({ where: { id: u.id }, data: { active: false } });
      } else {
        await prisma.user.delete({ where: { id: u.id } });
      }
    }

    console.log("  cleaned others:", others.length);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

