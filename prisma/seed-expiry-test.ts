/**
 * Seed za testiranje stranice "Istek po mjesecima".
 * Kreira 8-10 kupaca s razlicitim email adresama i aparate s razlicitim
 * PP/UP rokovima isteka (ovaj mjesec, sljedeci, zaostaci).
 *
 * Pokretanje: npx ts-node -P tsconfig.seed.json prisma/seed-expiry-test.ts
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

const CUSTOMERS = [
  { name: "KOS Transporti d.o.o.",     short: "KOS Transporti",   oib: "11111111101", email: "kos@example.com" },
  { name: "Vatromont d.o.o.",           short: "Vatromont",        oib: "22222222201", email: "vatromont@example.com" },
  { name: "Gradska plinara Zagreb",     short: "Plinara ZG",      oib: "33333333301", email: "plinara@example.com" },
  { name: "Auto Krizevci d.o.o.",       short: "Auto Krizevci",   oib: "44444444401", email: "auto@example.com" },
  { name: "Hotel Panorama",             short: "Panorama",         oib: "55555555501", email: "panorama@example.com" },
  { name: "Školski centar Varaždin",    short: "ŠC Varaždin",     oib: "66666666601", email: "sc-varazdin@example.com" },
  { name: "Općina Bednja",              short: "Bednja",           oib: "77777777701", email: null },
  { name: "Fitness Studio Iron",        short: "Iron Fitness",     oib: "88888888801", email: "iron.fitness@example.com" },
  { name: "Dječji vrtić Zvjezdice",     short: "DV Zvjezdice",    oib: "99999999901", email: "zvjezdice@example.com" },
  { name: "Mesnica Horvat",             short: "Horvat",           oib: "10101010101", email: "horvat@example.com" },
];

interface AppConfig {
  ppMonthsBack: number;
  upMonthsBack: number | null;
  count: number;
}

const CONFIG: AppConfig[] = [
  { ppMonthsBack: 12, upMonthsBack: null,  count: 8 },
  { ppMonthsBack: 12, upMonthsBack: 60,    count: 5 },
  { ppMonthsBack: 11, upMonthsBack: null,  count: 10 },
  { ppMonthsBack: 13, upMonthsBack: null,  count: 4 },
  { ppMonthsBack: 14, upMonthsBack: 58,    count: 6 },
  { ppMonthsBack: 15, upMonthsBack: null,  count: 3 },
  { ppMonthsBack: 10, upMonthsBack: null,  count: 7 },
  { ppMonthsBack: 18, upMonthsBack: null,  count: 5 },
  { ppMonthsBack: 12, upMonthsBack: 59,    count: 9 },
  { ppMonthsBack: 24, upMonthsBack: null,  count: 4 },
];

async function main() {
  console.log("🌱 Kreiranje kupaca i aparata za testiranje isteka...\n");

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Nema tvrtke. Pokreni: npx prisma db seed");

  const servicers = await prisma.user.findMany({
    where: { companyId: company.id, role: "SERVISER", active: true },
    select: { id: true },
  });
  if (servicers.length === 0) throw new Error("Nema aktivnog servisera.");

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) throw new Error("Nema admina.");

  let type = await prisma.extinguisherType.findFirst({ where: { code: "P6" } });
  if (!type) {
    const agent = await prisma.agentType.findUnique({ where: { code: "PRAH" } });
    const construction = await prisma.construction.findUnique({ where: { code: "STORED_PRESSURE" } });
    if (!agent || !construction) throw new Error("Nema default AgentType/Construction. Pokreni: npx prisma db seed");
    type = await prisma.extinguisherType.create({
      data: {
        code: "P6",
        name: "Prah 6 kg",
        agentId: agent.id,
        constructionId: construction.id,
        capacity: 6,
        capacityUnit: "KG",
      },
    });
  }

  let mfr = await prisma.manufacturer.findFirst();
  if (!mfr) {
    mfr = await prisma.manufacturer.create({
      data: { name: "Pastor" },
    });
  }

  const now = new Date();
  let orderSeq = 900;
  let extSeq = 5000;

  for (let ci = 0; ci < CUSTOMERS.length; ci++) {
    const custData = CUSTOMERS[ci];
    const cfg = CONFIG[ci];

    let customer = await prisma.customer.findFirst({
      where: { companyId: company.id, oib: custData.oib },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          companyId: company.id,
          type: "LEGAL",
          name: custData.name,
          shortName: custData.short,
          oib: custData.oib,
          address: "Testna adresa " + (ci + 1),
          email: custData.email,
        },
      });
      console.log(`  ✅ Kreiran kupac: ${custData.short} (email: ${custData.email ?? "N/A"})`);
    } else {
      if (custData.email && customer.email !== custData.email) {
        await prisma.customer.update({ where: { id: customer.id }, data: { email: custData.email } });
      }
      console.log(`  ℹ️  Kupac postoji: ${custData.short}`);
    }

    const servicedAt = new Date(
      now.getFullYear(),
      now.getMonth() - cfg.ppMonthsBack,
      15, 10, 0, 0
    );

    const ppDue = endOfMonthPlusYears(servicedAt, 1);

    const upDue = cfg.upMonthsBack
      ? endOfMonthPlusYears(
          new Date(now.getFullYear(), now.getMonth() - cfg.upMonthsBack, 15),
          5,
        )
      : null;

    orderSeq++;
    const orderNumber = makeOrderNumber(servicedAt, orderSeq);

    const order = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber,
        customerId: customer.id,
        status: "LOCKED",
        receivedAt: servicedAt,
        startedAt: servicedAt,
        finishedAt: servicedAt,
        deliveryMode: "CUSTOMER",
        receivedQty: cfg.count,
        lockedAt: servicedAt,
        lockedById: admin.id,
      },
    });

    for (let i = 0; i < cfg.count; i++) {
      extSeq++;
      const sn = `SN-EXP-${pad3(extSeq)}`;
      const intCode = `P6-${pad3(extSeq)}`;

      const ext = await prisma.extinguisher.create({
        data: {
          companyId: company.id,
          internalCode: intCode,
          serialNumber: sn,
          productionYear: 2018 + (ci % 4),
          manufacturerId: mfr.id,
          extinguisherTypeId: type.id,
          lastPeriodicAt: servicedAt,
          nextPeriodicDue: ppDue,
          lastInternalAt: cfg.upMonthsBack
            ? new Date(now.getFullYear(), now.getMonth() - cfg.upMonthsBack, 15)
            : null,
          nextInternalDue: upDue,
        },
      });

      const serviser = servicers[i % servicers.length];

      await prisma.workOrderItem.create({
        data: {
          companyId: company.id,
          workOrderId: order.id,
          extinguisherId: ext.id,
          servicerId: serviser.id,
          periodicDone: true,
          internalDone: !!cfg.upMonthsBack,
          labelNumber: `L-${pad3(extSeq)}`,
          servicedAt: servicedAt,
          nextPeriodicDue: ppDue,
          nextInternalDue: upDue,
        },
      });
    }

    const ppStatus = ppDue < now ? "ISTEKAO" : ppDue.getMonth() === now.getMonth() && ppDue.getFullYear() === now.getFullYear() ? "OVAJ MJESEC" : "BUDUCNOST";
    console.log(`     Nalog ${orderNumber}: ${cfg.count} aparata, PP rok: ${ppDue.toISOString().slice(0, 10)} (${ppStatus})\n`);
  }

  console.log("✅ Seed završen!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
