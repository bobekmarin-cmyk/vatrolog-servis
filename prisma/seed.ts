import {
  AccountRole,
  CustomerType,
  PlatformRole,
  PrismaClient,
  ServiceLocationKind,
  UserRole,
  WorkOrderStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  buildAdminUsername,
  buildLocationLabel,
  buildLocationUsername,
  deriveUsernameSlug,
} from "../src/lib/companyAccountNaming";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  const serviceCode = (process.env.SEED_SERVICE_CODE ?? "01").replace(/\D/g, "").slice(0, 2).padStart(2, "0");
  const usernameSlug =
    (process.env.SEED_USERNAME_SLUG ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15) ||
    deriveUsernameSlug("Moja tvrtka") ||
    "devco";

  // DEFAULT COMPANY + SAAS ACCOUNTS
  const company = await prisma.company.upsert({
    where: { id: "company_default" },
    update: {
      serviceCode,
      usernameSlug,
      // potrebno za setupComplete nakon prijave (IBAN + email + telefon)
      email: process.env.SEED_COMPANY_EMAIL ?? "dev@localhost.local",
      phone: process.env.SEED_COMPANY_PHONE ?? "+38500000000",
    },
    create: {
      id: "company_default",
      name: "Moja tvrtka",
      oib: "00000000000",
      serviceCode,
      usernameSlug,
      street: "Ulica 1",
      city: "Grad",
      postalCode: "00000",
      iban: "HR0000000000000000000",
      email: process.env.SEED_COMPANY_EMAIL ?? "dev@localhost.local",
      phone: process.env.SEED_COMPANY_PHONE ?? "+38500000000",
    },
  });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const workshopPassword = process.env.SEED_WORKSHOP_PASSWORD ?? "workshop123";

  const [adminHash, workshopHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(workshopPassword, 10),
  ]);

  const adminUsername = buildAdminUsername(serviceCode, usernameSlug);
  const workshopUsername = buildLocationUsername(serviceCode, usernameSlug, "STATIONARY", 1);

  await prisma.accountUser.deleteMany({ where: { companyId: company.id } });
  await prisma.companyServiceLocation.deleteMany({ where: { companyId: company.id } });

  const stationary = await prisma.companyServiceLocation.create({
    data: {
      companyId: company.id,
      kind: ServiceLocationKind.STATIONARY,
      ordinal: 1,
      label: buildLocationLabel("STATIONARY", 1),
    },
  });

  await prisma.accountUser.createMany({
    data: [
      {
        companyId: company.id,
        username: adminUsername,
        passwordHash: adminHash,
        role: AccountRole.ADMIN,
        active: true,
        serviceLocationId: null,
      },
      {
        companyId: company.id,
        username: workshopUsername,
        passwordHash: workshopHash,
        role: AccountRole.WORKSHOP,
        active: true,
        serviceLocationId: stationary.id,
      },
    ],
  });

  console.log(`   Tenant admin login: ${adminUsername} / ${adminPassword}`);
  console.log(`   Workshop login:    ${workshopUsername} / ${workshopPassword}`);

  // PLATFORM USER (ULTRA ADMIN)
  const platformPassword = process.env.SEED_PLATFORM_PASSWORD ?? "owner123";
  const platformHash = await bcrypt.hash(platformPassword, 10);

  await prisma.platformUser.upsert({
    where: { username: "owner" },
    update: { passwordHash: platformHash, active: true, role: PlatformRole.OWNER },
    create: {
      username: "owner",
      passwordHash: platformHash,
      active: true,
      role: PlatformRole.OWNER,
    },
  });

  // DEFAULT FEATURES (per company + role)
  const featureDefaults: Array<[string, { admin: boolean; workshop: boolean }]> = [
    ["DASHBOARD", { admin: true, workshop: true }],
    ["RECEIPTS", { admin: true, workshop: true }],
    ["WORK_ORDERS", { admin: true, workshop: true }],
    ["EXTINGUISHERS", { admin: true, workshop: true }],
    ["CUSTOMERS", { admin: true, workshop: false }],
    ["REPORTS_MONTHLY", { admin: true, workshop: false }],
    ["ADMIN_SERVICERS", { admin: true, workshop: false }],
  ];

  for (const [key, cfg] of featureDefaults) {
    await prisma.companyFeature.upsert({
      where: { companyId_key: { companyId: company.id, key } },
      create: {
        companyId: company.id,
        key,
        enabledForAdmin: cfg.admin,
        enabledForWorkshop: cfg.workshop,
      },
      update: {
        enabledForAdmin: cfg.admin,
        enabledForWorkshop: cfg.workshop,
      },
    });
  }

  // USERS
  await prisma.user.createMany({
    data: [
      { fullName: "Admin", role: UserRole.ADMIN, companyId: company.id },
      { fullName: "Ivan", role: UserRole.SERVISER, companyId: company.id },
      { fullName: "Marko", role: UserRole.SERVISER, companyId: company.id },
      { fullName: "Luka", role: UserRole.SERVISER, companyId: company.id },
    ],
    skipDuplicates: true
  });

  // CATALOG: AgentType (sredstva gašenja)
  const agentDefaults: Array<{ code: string; label: string; symbol?: string | null; sortOrder: number }> = [
    { code: "PRAH", label: "Prah", symbol: "ABC", sortOrder: 10 },
    { code: "PJENA", label: "Pjena", symbol: "AB", sortOrder: 20 },
    { code: "VODA", label: "Voda", symbol: "A", sortOrder: 30 },
    { code: "WET_CHEMICAL", label: "Wet chemical", symbol: "F", sortOrder: 40 },
    { code: "CO2", label: "CO2", symbol: "CO2", sortOrder: 50 },
    { code: "F500", label: "F-500", symbol: "F500", sortOrder: 60 },
  ];
  for (const a of agentDefaults) {
    await prisma.agentType.upsert({
      where: { code: a.code },
      update: { label: a.label, symbol: a.symbol ?? null, sortOrder: a.sortOrder },
      create: { code: a.code, label: a.label, symbol: a.symbol ?? null, sortOrder: a.sortOrder },
    });
  }

  // CATALOG: Construction (izvedbe)
  const constructionDefaults: Array<{ code: string; label: string; prefix?: string | null; sortOrder: number }> = [
    { code: "STORED_PRESSURE", label: "Stalni tlak", prefix: "P", sortOrder: 10 },
    { code: "CARTRIDGE", label: "Bočica", prefix: "S", sortOrder: 20 },
    { code: "CO2", label: "CO2", prefix: "CO2", sortOrder: 30 },
  ];
  for (const c of constructionDefaults) {
    await prisma.construction.upsert({
      where: { code: c.code },
      update: { label: c.label, prefix: c.prefix ?? null, sortOrder: c.sortOrder },
      create: { code: c.code, label: c.label, prefix: c.prefix ?? null, sortOrder: c.sortOrder },
    });
  }

  const agentPrah = await prisma.agentType.findUnique({ where: { code: "PRAH" } });
  const agentPjena = await prisma.agentType.findUnique({ where: { code: "PJENA" } });
  const agentCo2 = await prisma.agentType.findUnique({ where: { code: "CO2" } });
  const conStored = await prisma.construction.findUnique({ where: { code: "STORED_PRESSURE" } });
  const conCo2 = await prisma.construction.findUnique({ where: { code: "CO2" } });

  if (!agentPrah || !agentPjena || !agentCo2 || !conStored || !conCo2) {
    throw new Error("Catalog seed failed");
  }

  // MANUFACTURERS
  await prisma.manufacturer.createMany({
    data: [
      { name: "Pastor" },
      { name: "Total" },
      { name: "Klaleda" },
    ],
    skipDuplicates: true,
  });

  const mPastor = await prisma.manufacturer.findUnique({ where: { name: "Pastor" } });
  const mTotal = await prisma.manufacturer.findUnique({ where: { name: "Total" } });
  const mKlaleda = await prisma.manufacturer.findUnique({ where: { name: "Klaleda" } });

  // CUSTOMER
  await prisma.customer.createMany({
    data: [
      {
        companyId: company.id,
        type: CustomerType.LEGAL,
        name: "Meta Room d.o.o.",
        shortName: "Meta Room d.o.o.",
        oib: "12345678901",
        street: "Primjer ulica 1",
        postalCode: "42220",
        city: "Novi Marof",
        address: "Primjer ulica 1, Novi Marof",
        contactPerson: "Kontakt osoba",
        phone: "+385911234567",
        email: "info@metaroom.hr"
      }
    ],
    skipDuplicates: true
  });

  const customer = await prisma.customer.findUnique({
    where: { companyId_oib: { companyId: company.id, oib: "12345678901" } }
  });

  if (!customer) {
    throw new Error("Customer not found after seed");
  }

  // EXTINGUISHER TYPES (catalog) - vezani na AgentType + Construction
  const typeSpecs: Array<{
    code: string;
    name: string;
    agentId: string;
    constructionId: string;
    capacity: number;
    capacityUnit: "KG" | "L";
  }> = [
    { code: "P6", name: "P6 prah", agentId: agentPrah.id, constructionId: conStored.id, capacity: 6, capacityUnit: "KG" },
    { code: "P9", name: "P9 prah", agentId: agentPrah.id, constructionId: conStored.id, capacity: 9, capacityUnit: "KG" },
    { code: "S9", name: "S9 prah (bočica)", agentId: agentPrah.id, constructionId: conStored.id, capacity: 9, capacityUnit: "KG" },
    { code: "CO2-5", name: "CO2 5kg", agentId: agentCo2.id, constructionId: conCo2.id, capacity: 5, capacityUnit: "KG" },
  ];
  for (const t of typeSpecs) {
    await prisma.extinguisherType.upsert({
      where: { code_agentId: { code: t.code, agentId: t.agentId } },
      update: {
        name: t.name,
        constructionId: t.constructionId,
        capacity: t.capacity,
        capacityUnit: t.capacityUnit,
      },
      create: t,
    });
  }

  const typeP6 = await prisma.extinguisherType.findUnique({ where: { code_agentId: { code: "P6", agentId: agentPrah.id } } });
  const typeP9 = await prisma.extinguisherType.findUnique({ where: { code_agentId: { code: "P9", agentId: agentPrah.id } } });
  const typeCo25 = await prisma.extinguisherType.findUnique({ where: { code_agentId: { code: "CO2-5", agentId: agentCo2.id } } });

  if (!typeP6 || !typeP9 || !typeCo25 || !mPastor || !mTotal || !mKlaleda) {
    throw new Error("Types/manufacturers seed failed");
  }

  // MANUFACTURER SUPPORTED TYPES
  const mftLinks: Array<{ manufacturerId: string; extinguisherTypeId: string }> = [
    { manufacturerId: mPastor.id, extinguisherTypeId: typeP6.id },
    { manufacturerId: mPastor.id, extinguisherTypeId: typeP9.id },
    { manufacturerId: mPastor.id, extinguisherTypeId: typeCo25.id },
    { manufacturerId: mTotal.id, extinguisherTypeId: typeP6.id },
    { manufacturerId: mTotal.id, extinguisherTypeId: typeP9.id },
    { manufacturerId: mKlaleda.id, extinguisherTypeId: typeP9.id },
  ];
  for (const l of mftLinks) {
    await prisma.manufacturerExtinguisherType.upsert({
      where: { manufacturerId_extinguisherTypeId: l },
      update: {},
      create: l,
    });
  }

  // PARTS (global, per-manufacturer) s vezom na tipove
  const partSpecs: Array<{
    manufacturerId: string;
    code: string;
    name: string;
    common: boolean;
    typeIds: string[];
  }> = [
    { manufacturerId: mPastor.id, code: "P-BRT-01", name: "Brtva ventila", common: true, typeIds: [typeP6.id, typeP9.id] },
    { manufacturerId: mPastor.id, code: "P-MAN-01", name: "Manometar", common: true, typeIds: [typeP6.id, typeP9.id] },
    { manufacturerId: mPastor.id, code: "P-CRI-01", name: "Crijevo", common: false, typeIds: [typeP9.id] },
    { manufacturerId: mTotal.id, code: "T-BRT-01", name: "Brtva ventila", common: true, typeIds: [typeP6.id, typeP9.id] },
    { manufacturerId: mKlaleda.id, code: "K-BRT-01", name: "Brtva ventila", common: true, typeIds: [typeP9.id] },
  ];
  for (const p of partSpecs) {
    const existingPart = await prisma.part.findFirst({
      where: {
        manufacturerId: p.manufacturerId,
        companyId: null,
        code: p.code,
      },
    });
    const part = existingPart
      ? await prisma.part.update({
          where: { id: existingPart.id },
          data: { name: p.name, common: p.common, active: true },
        })
      : await prisma.part.create({
          data: {
            manufacturerId: p.manufacturerId,
            companyId: null,
            code: p.code,
            name: p.name,
            common: p.common,
            active: true,
          },
        });
    for (const typeId of p.typeIds) {
      await prisma.partExtinguisherType.upsert({
        where: { partId_extinguisherTypeId: { partId: part.id, extinguisherTypeId: typeId } },
        update: {},
        create: { partId: part.id, extinguisherTypeId: typeId },
      });
    }
  }

  
  // WORK ORDER (example)
  const existing = await prisma.workOrder.findUnique({
    where: { companyId_orderNumber: { companyId: company.id, orderNumber: "26-01-001" } }
  });

  if (!existing) {
    const seedAdmin = await prisma.accountUser.findFirst({
      where: { companyId: company.id, role: AccountRole.ADMIN },
      select: { id: true },
    });
    await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber: "26-01-001",
        status: WorkOrderStatus.IN_PROGRESS,
        customerId: customer.id,
        receivedAt: new Date(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryMode: "CUSTOMER",
        serviceLocationId: stationary.id,
        createdByAccountUserId: seedAdmin?.id ?? null,
        receivedQty: 5,
        items: {
          create: [
            { companyId: company.id, isPlaceholder: true },
            { companyId: company.id, isPlaceholder: true },
            { companyId: company.id, isPlaceholder: true },
            { companyId: company.id, isPlaceholder: true },
            { companyId: company.id, isPlaceholder: true },
          ],
        },
      },
    });
  }

  console.log("✅ Seed done");
  console.log("🔐 Login (dev):");
  console.log(`   - ${adminUsername} /`, adminPassword);
  console.log(`   - ${workshopUsername} /`, workshopPassword);
  console.log("   - platform owner /", platformPassword, "(platform: /platform/login)");
}

main()
  .catch((e) => {
    console.error("❌ Seed error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
