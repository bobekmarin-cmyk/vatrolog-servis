/* eslint-disable */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const counts = {
    Manufacturer: await prisma.manufacturer.count(),
    ServiceLabel: await prisma.serviceLabel.count(),
    Company: await prisma.company.count(),
    AccountUser: await prisma.accountUser.count(),
    Extinguisher: await prisma.extinguisher.count(),
    ExtinguisherType: await prisma.extinguisherType.count(),
    ManufacturerExtinguisherType: await prisma.manufacturerExtinguisherType.count(),
    CompanyManufacturerAuthorization: await prisma.companyManufacturerAuthorization.count(),
    PlatformUser: await prisma.platformUser.count(),
  };
  console.log("counts:", counts);

  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
      blocked: true,
      activeUntil: true,
      iban: true,
      email: true,
      phone: true,
      _count: { select: { accounts: true, authorizations: true } },
    },
  });
  console.log("companies:", JSON.stringify(companies, null, 2));

  const platformUsers = await prisma.platformUser.findMany({
    select: { id: true, username: true, role: true, active: true },
  });
  console.log("platformUsers:", JSON.stringify(platformUsers, null, 2));

  const accounts = await prisma.accountUser.findMany({
    select: { id: true, username: true, role: true, active: true, companyId: true },
  });
  console.log("accountUsers:", JSON.stringify(accounts, null, 2));

  const auths = await prisma.companyManufacturerAuthorization.findMany({
    select: {
      companyId: true,
      manufacturerId: true,
      active: true,
      manufacturer: { select: { name: true } },
    },
  });
  console.log("authorizations:", JSON.stringify(auths, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
