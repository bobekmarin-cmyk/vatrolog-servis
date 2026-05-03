/**
 * Simulacija za testiranje 3 statusa: Servisiran, Istekao servis, Rashodovan.
 * Kreira ~20 primki/naloga sa ~100 aparata raspodijeljenih po statusima.
 * Pokretanje: npx ts-node -P tsconfig.seed.json prisma/seed-status-test.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function pad2(n: number) { return String(n).padStart(2, "0"); }
function pad3(n: number) { return String(n).padStart(3, "0"); }

function makeOrderNumber(d: Date, seq: number) {
  return `${String(d.getFullYear()).slice(-2)}-${pad2(d.getMonth() + 1)}-${pad3(seq)}`;
}

function endOfMonthPlusYears(ref: Date, years: number): Date {
  const d = new Date(ref.getFullYear() + years, ref.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 Kreiranje test podataka za statuse (3 vrste)...\n");

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Nema tvrtke. Pokreni: npx prisma db seed");

  let customer = await prisma.customer.findFirst({ where: { companyId: company.id } });
  if (!customer) throw new Error("Nema kupca. Pokreni: npx prisma db seed");

  const servicers = await prisma.user.findMany({
    where: { companyId: company.id, role: "SERVISER", active: true },
    select: { id: true },
  });
  if (servicers.length === 0) throw new Error("Nema servisera.");

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
    select: { id: true },
  });
  const lockUser = admin ?? servicers[0];

  const manufacturer = await prisma.manufacturer.findFirst();
  const types = await prisma.extinguisherType.findMany();
  if (!manufacturer || types.length === 0) throw new Error("Nema proizvođača/tipova.");

  // Extra customers for variety
  const customerNames = [
    { name: "Vatrozaštita Plus d.o.o.", oib: "11223344556", city: "Zagreb" },
    { name: "Hotel Panorama d.o.o.", oib: "22334455667", city: "Split" },
    { name: "Osnovna škola Ruđer Bošković", oib: "33445566778", city: "Varaždin" },
    { name: "Konzum d.d.", oib: "44556677889", city: "Zagreb" },
  ];
  const allCustomers = [customer];

  for (const cn of customerNames) {
    const c = await prisma.customer.upsert({
      where: { companyId_oib: { companyId: company.id, oib: cn.oib } },
      create: {
        companyId: company.id,
        type: "LEGAL",
        name: cn.name,
        shortName: cn.name,
        oib: cn.oib,
        street: "Ulica " + cn.city + " 1",
        postalCode: "10000",
        city: cn.city,
        address: `Ulica ${cn.city} 1, ${cn.city}`,
      },
      update: {},
    });
    allCustomers.push(c);
  }

  // 20 orders, distributed across dates and customers
  interface OrderDef {
    daysAgoVal: number;
    numItems: number;
    lock: boolean;
    customerIdx: number;
  }

  const orderDefs: OrderDef[] = [
    // Very old (PP expired) - serviced 500+ days ago → PP expired
    { daysAgoVal: 550, numItems: 7, lock: true, customerIdx: 0 },
    { daysAgoVal: 520, numItems: 5, lock: true, customerIdx: 1 },
    { daysAgoVal: 480, numItems: 6, lock: true, customerIdx: 2 },
    { daysAgoVal: 450, numItems: 4, lock: true, customerIdx: 0 },
    // Old (PP expired) - ~400 days ago
    { daysAgoVal: 420, numItems: 5, lock: true, customerIdx: 3 },
    { daysAgoVal: 400, numItems: 6, lock: true, customerIdx: 4 },
    { daysAgoVal: 395, numItems: 4, lock: true, customerIdx: 1 },
    // Medium-old (~380 days, PP borderline)
    { daysAgoVal: 380, numItems: 5, lock: true, customerIdx: 2 },
    { daysAgoVal: 370, numItems: 4, lock: true, customerIdx: 0 },
    // Recent but PP will expire soon (~340 days ago, ~25 days left)
    { daysAgoVal: 340, numItems: 5, lock: true, customerIdx: 3 },
    // Recent - PP still valid
    { daysAgoVal: 180, numItems: 6, lock: true, customerIdx: 0 },
    { daysAgoVal: 120, numItems: 5, lock: true, customerIdx: 1 },
    { daysAgoVal: 90, numItems: 4, lock: true, customerIdx: 4 },
    { daysAgoVal: 60, numItems: 6, lock: true, customerIdx: 2 },
    { daysAgoVal: 30, numItems: 5, lock: true, customerIdx: 3 },
    { daysAgoVal: 14, numItems: 7, lock: true, customerIdx: 0 },
    { daysAgoVal: 7, numItems: 5, lock: true, customerIdx: 1 },
    { daysAgoVal: 3, numItems: 4, lock: true, customerIdx: 4 },
    // Open orders (not locked)
    { daysAgoVal: 2, numItems: 5, lock: false, customerIdx: 2 },
    { daysAgoVal: 1, numItems: 3, lock: false, customerIdx: 0 },
  ];

  const totalExtCount = orderDefs.reduce((s, o) => s + o.numItems, 0);
  console.log(`  Planirano: ${orderDefs.length} naloga, ${totalExtCount} aparata\n`);

  // Get next available sequence number
  const lastOrder = await prisma.workOrder.findFirst({
    where: { companyId: company.id },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  let nextSeq = 200;
  if (lastOrder?.orderNumber) {
    const parts = lastOrder.orderNumber.split("-");
    const lastSeq = Number(parts[2] ?? "0");
    if (Number.isFinite(lastSeq) && lastSeq >= 200) nextSeq = lastSeq + 1;
  }

  let extIdx = 1;
  let labelNum = 5000;

  // Track created extinguishers for scrapping some later
  const createdExtIds: string[] = [];
  const expiredExtIds: string[] = [];

  for (let i = 0; i < orderDefs.length; i++) {
    const def = orderDefs[i];
    const receivedAt = daysAgo(def.daysAgoVal);
    const cust = allCustomers[def.customerIdx % allCustomers.length];
    const orderNumber = makeOrderNumber(receivedAt, nextSeq + i);

    const nextPP = endOfMonthPlusYears(receivedAt, 1);
    const nextUP = endOfMonthPlusYears(receivedAt, 5);

    // Create extinguishers for this order
    const extIds: string[] = [];
    for (let j = 0; j < def.numItems; j++) {
      const code = `TST-${pad3(extIdx)}`;
      extIdx++;
      const typeObj = types[j % types.length];

      const ext = await prisma.extinguisher.upsert({
        where: { companyId_internalCode: { companyId: company.id, internalCode: code } },
        create: {
          companyId: company.id,
          internalCode: code,
          serialNumber: `SN-TST-${pad3(extIdx)}`,
          productionYear: 2015 + (extIdx % 10),
          manufacturerId: manufacturer.id,
          extinguisherTypeId: typeObj.id,
          status: "ACTIVE",
          lastPeriodicAt: receivedAt,
          nextPeriodicDue: nextPP,
          lastInternalAt: receivedAt,
          nextInternalDue: nextUP,
        },
        update: {
          lastPeriodicAt: receivedAt,
          nextPeriodicDue: nextPP,
          lastInternalAt: receivedAt,
          nextInternalDue: nextUP,
        },
      });
      extIds.push(ext.id);
      createdExtIds.push(ext.id);

      const now = new Date();
      if (nextPP < now) expiredExtIds.push(ext.id);
    }

    // Create order with receipt
    const order = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber,
        status: def.lock ? "LOCKED" : "IN_PROGRESS",
        customerId: cust.id,
        receivedAt,
        dueAt: new Date(receivedAt.getTime() + 7 * 86400000),
        startedAt: receivedAt,
        deliveryMode: "CUSTOMER",
        receivedQty: def.numItems,
        lockedAt: def.lock ? new Date(receivedAt.getTime() + 86400000) : undefined,
        lockedById: def.lock ? lockUser.id : undefined,
        items: {
          create: extIds.map((eid, j) => {
            labelNum++;
            const servicer = servicers[j % servicers.length];
            return {
              companyId: company.id,
              isPlaceholder: false,
              extinguisherId: eid,
              servicerId: def.lock ? servicer.id : undefined,
              labelNumber: `LBL-T-${pad3(labelNum)}`,
              servicedAt: def.lock ? receivedAt : undefined,
              periodicDone: def.lock,
              internalDone: def.lock,
              internalDoneAt: def.lock ? receivedAt : undefined,
              nextPeriodicDue: def.lock ? nextPP : undefined,
              nextInternalDue: def.lock ? nextUP : undefined,
            };
          }),
        },
      },
    });

    const ppDate = nextPP.toISOString().slice(0, 10);
    const now = new Date();
    const ppOk = nextPP > now;
    console.log(
      `  ${orderNumber} | ${cust.shortName ?? cust.name} | ${def.numItems} ap. | ${receivedAt.toISOString().slice(0, 10)} | PP: ${ppDate} ${ppOk ? "✅" : "❌"} | ${def.lock ? "🔒" : "🔓"}`
    );
  }

  // Scrap ~8 extinguishers (mix of old and recent)
  const toScrap = [
    ...expiredExtIds.slice(0, 5),
    ...createdExtIds.slice(-10, -7),
  ];

  for (const eid of toScrap) {
    await prisma.extinguisher.update({
      where: { id: eid },
      data: {
        status: "SCRAPPED",
        scrappedAt: new Date(),
        scrapReason: "Korozija spremnika",
      },
    });
  }
  console.log(`\n  🗑️  Rashodovano: ${toScrap.length} aparata`);

  // Summary
  const totalExt = await prisma.extinguisher.count({
    where: { companyId: company.id, internalCode: { startsWith: "TST-" } },
  });
  const scrappedCount = await prisma.extinguisher.count({
    where: { companyId: company.id, internalCode: { startsWith: "TST-" }, status: "SCRAPPED" },
  });
  const now = new Date();
  const expiredCount = await prisma.extinguisher.count({
    where: {
      companyId: company.id,
      internalCode: { startsWith: "TST-" },
      status: "ACTIVE",
      nextPeriodicDue: { lt: now },
    },
  });
  const validCount = totalExt - scrappedCount - expiredCount;

  console.log(`\n  📊 Ukupno TST aparata: ${totalExt}`);
  console.log(`     ✅ Servisiran (PP vrijedi): ${validCount}`);
  console.log(`     ⚠️  Istekao servis (PP istekao): ${expiredCount}`);
  console.log(`     🗑️  Rashodovan: ${scrappedCount}`);
  console.log("\n✅ Seed gotov!");
}

main()
  .catch((e) => { console.error("❌ Greška:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
