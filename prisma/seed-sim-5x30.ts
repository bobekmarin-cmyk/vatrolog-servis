/**
 * Simulacija: 5 radnih naloga x 30 aparata = 150 servisiranih aparata.
 * Datumi zadnjih 5 radnih dana, svi servisirani i zakljucani.
 *
 * Pokretanje: npx ts-node -P tsconfig.seed.json prisma/seed-sim-5x30.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORDERS = 5;
const ITEMS_PER_ORDER = 30;
const TOTAL_ITEMS = ORDERS * ITEMS_PER_ORDER;
const PREFIX_INTERNAL = "SIM30-";

function two(n: number) {
  return String(n).padStart(2, "0");
}
function three(n: number) {
  return String(n).padStart(3, "0");
}
function four(n: number) {
  return String(n).padStart(4, "0");
}

function makeOrderNumber(d: Date, seq: number) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = two(d.getMonth() + 1);
  return `${yy}-${mm}-${three(seq)}`;
}

function calcValidUntil(serviceDate: Date): Date {
  const y = serviceDate.getFullYear();
  const m = serviceDate.getMonth();
  const d = new Date(y + 1, m + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function sameMonthEndAs(referenceDate: Date, year: number): Date {
  const month = referenceDate.getMonth();
  const d = new Date(year, month + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function lastWorkingDays(n: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  while (out.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

async function main() {
  console.log(`Kreiranje ${ORDERS} radnih naloga x ${ITEMS_PER_ORDER} aparata...`);

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Nema tvrtke. Pokreni: npx prisma db seed");

  const customer = await prisma.customer.findFirst({ where: { companyId: company.id } });
  if (!customer) throw new Error("Nema kupca. Pokreni: npx prisma db seed");

  const servicers = await prisma.user.findMany({
    where: { companyId: company.id, role: "SERVISER", active: true },
    select: { id: true },
  });
  if (servicers.length === 0) throw new Error("Nema aktivnih servisera.");

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
    select: { id: true },
  });
  const lockUser = admin ?? servicers[0];
  if (!lockUser) throw new Error("Nema korisnika za zakljucavanje.");

  const manufacturers = await prisma.manufacturer.findMany({
    include: {
      supportedTypes: { select: { extinguisherTypeId: true } },
    },
  });
  if (manufacturers.length === 0) throw new Error("Nema proizvodaca.");

  const allTypes = await prisma.extinguisherType.findMany({
    select: { id: true },
  });
  if (allTypes.length === 0) throw new Error("Nema tipova aparata.");

  type PairItem = { manufacturerId: string; extinguisherTypeId: string };
  const pairs: PairItem[] = [];
  for (const m of manufacturers) {
    const supportedIds = m.supportedTypes.map((s) => s.extinguisherTypeId);
    const usable = supportedIds.length > 0 ? supportedIds : allTypes.map((t) => t.id);
    for (const tid of usable) {
      pairs.push({ manufacturerId: m.id, extinguisherTypeId: tid });
    }
  }
  if (pairs.length === 0) throw new Error("Nema kombinacija proizvodac-tip.");

  const workingDays = lastWorkingDays(ORDERS);

  const prefix = `${String(workingDays[0].getFullYear()).slice(-2)}-${two(workingDays[0].getMonth() + 1)}-`;
  const lastOrder = await prisma.workOrder.findFirst({
    where: { companyId: company.id, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  let nextSeq = 201;
  if (lastOrder?.orderNumber) {
    const parts = lastOrder.orderNumber.split("-");
    const lastSeq = Number(parts[2] ?? "0");
    if (Number.isFinite(lastSeq) && lastSeq >= 201) nextSeq = lastSeq + 1;
  }

  const existingSim = await prisma.extinguisher.count({
    where: { companyId: company.id, internalCode: { startsWith: PREFIX_INTERNAL } },
  });
  const toCreate = TOTAL_ITEMS - existingSim;
  if (toCreate > 0) {
    console.log(`  Kreiram ${toCreate} novih aparata (${PREFIX_INTERNAL}xxxx)...`);
    const start = existingSim + 1;
    for (let i = start; i <= existingSim + toCreate; i++) {
      const code = `${PREFIX_INTERNAL}${four(i)}`;
      const pair = pairs[(i - 1) % pairs.length];
      await prisma.extinguisher.upsert({
        where: { companyId_internalCode: { companyId: company.id, internalCode: code } },
        create: {
          companyId: company.id,
          internalCode: code,
          serialNumber: `SN-${code}`,
          productionYear: 2018 + (i % 7),
          manufacturerId: pair.manufacturerId,
          extinguisherTypeId: pair.extinguisherTypeId,
          status: "ACTIVE",
        },
        update: {},
      });
    }
  }

  const extinguishers = await prisma.extinguisher.findMany({
    where: { companyId: company.id, internalCode: { startsWith: PREFIX_INTERNAL } },
    orderBy: { internalCode: "asc" },
    select: { id: true, internalCode: true },
  });
  if (extinguishers.length < TOTAL_ITEMS) {
    throw new Error(`Nema dovoljno aparata (treba ${TOTAL_ITEMS}, ima ${extinguishers.length}).`);
  }

  const existingLabels = await prisma.workOrderItem.count({
    where: { companyId: company.id, labelNumber: { startsWith: "LBL-SIM30-" } },
  });
  let labelCounter = existingLabels;
  let extinguisherIndex = 0;

  for (let i = 0; i < ORDERS; i++) {
    const receivedAt = new Date(workingDays[i]);
    receivedAt.setHours(10, 0, 0, 0);
    const orderNumber = makeOrderNumber(receivedAt, nextSeq + i);

    const nextPeriodicDue = calcValidUntil(receivedAt);
    const nextInternalDue = sameMonthEndAs(nextPeriodicDue, receivedAt.getFullYear() + 5);

    const order = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber,
        status: "IN_PROGRESS",
        customerId: customer.id,
        receivedAt,
        dueAt: receivedAt,
        startedAt: receivedAt,
        deliveryMode: "CUSTOMER",
        receivedQty: ITEMS_PER_ORDER,
        items: {
          create: Array.from({ length: ITEMS_PER_ORDER }, (_, j) => {
            const ext = extinguishers[extinguisherIndex++];
            labelCounter++;
            const servicer = servicers[j % servicers.length];
            return {
              companyId: company.id,
              isPlaceholder: false,
              extinguisherId: ext.id,
              servicerId: servicer.id,
              labelNumber: `LBL-SIM30-${four(labelCounter)}`,
              servicedAt: receivedAt,
              periodicDone: true,
              internalDone: true,
              internalDoneAt: receivedAt,
              nextPeriodicDue,
              nextInternalDue,
            };
          }),
        },
      },
      include: { items: true },
    });

    for (const item of order.items) {
      if (item.extinguisherId) {
        await prisma.extinguisher.update({
          where: { id: item.extinguisherId },
          data: {
            lastPeriodicAt: receivedAt,
            nextPeriodicDue,
            lastInternalAt: receivedAt,
            nextInternalDue,
          },
        });
      }
    }

    await prisma.workOrder.update({
      where: { id: order.id },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: lockUser.id },
    });

    console.log(`  Nalog ${orderNumber} - ${ITEMS_PER_ORDER} aparata, datum ${receivedAt.toISOString().slice(0, 10)}`);
  }

  console.log(`Gotovo: ${ORDERS} naloga x ${ITEMS_PER_ORDER} aparata (${TOTAL_ITEMS} stavki).`);
}

main()
  .catch((e) => {
    console.error("Greska:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
