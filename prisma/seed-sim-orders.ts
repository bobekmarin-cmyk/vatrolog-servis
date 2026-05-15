/**
 * Simulacija: 10 radnih naloga, svaki 2–6 aparata, svi servisirani, zaključani.
 * Datumi zadnjih 2 tjedna (radni dani).
 * Pokretanje: npx ts-node -P tsconfig.seed.json prisma/seed-sim-orders.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function two(n: number) {
  return String(n).padStart(2, "0");
}
function three(n: number) {
  return String(n).padStart(3, "0");
}

function makeOrderNumber(d: Date, seq: number) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = two(d.getMonth() + 1);
  return `${yy}-${mm}-${three(seq)}`;
}

/** Zadnji dan mjeseca servisa + 1 godina (PP) */
function calcValidUntil(serviceDate: Date): Date {
  const y = serviceDate.getFullYear();
  const m = serviceDate.getMonth();
  const d = new Date(y + 1, m + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Zadnji dan istog mjeseca u danoj godini (UP) */
function sameMonthEndAs(referenceDate: Date, year: number): Date {
  const month = referenceDate.getMonth();
  const d = new Date(year, month + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Zadnjih N radnih dana (bez subote i nedjelje), od jučer unazad */
function lastWorkingDays(n: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1); // start from yesterday
  while (out.length < n) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) out.push(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

async function main() {
  console.log("🌱 Kreiranje 10 simuliranih radnih naloga (zadnjih 2 tjedna)...");

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error("Nema tvrtke. Pokreni prvo: npx prisma db seed");
  }

  const customer = await prisma.customer.findFirst({ where: { companyId: company.id } });
  if (!customer) {
    throw new Error("Nema kupca. Pokreni prvo: npx prisma db seed");
  }

  const servicers = await prisma.user.findMany({
    where: { companyId: company.id, role: "SERVISER", active: true },
    select: { id: true },
  });
  if (servicers.length === 0) {
    throw new Error("Nema servisera. Pokreni prvo: npx prisma db seed");
  }

  const admin = await prisma.user.findFirst({
    where: { companyId: company.id, role: "ADMIN" },
    select: { id: true },
  });
  const lockUser = admin ?? servicers[0];
  if (!lockUser) {
    throw new Error("Nema korisnika za zaključavanje naloga.");
  }

  const manufacturer = await prisma.manufacturer.findFirst();
  const type = await prisma.extinguisherType.findFirst();
  if (!manufacturer || !type) {
    throw new Error("Nema proizvođača ili tipa aparata. Pokreni seed.");
  }

  const workingDays = lastWorkingDays(10);
  if (workingDays.length < 10) {
    console.warn("Upozorenje: manje od 10 radnih dana u zadnjih 2 tjedna, koristit ću", workingDays.length);
  }

  // Sljedeći redni broj za orderNumber (da ne pregazimo postojeće)
  const prefix = `${String(workingDays[0].getFullYear()).slice(-2)}-${two(workingDays[0].getMonth() + 1)}-`;
  const lastOrder = await prisma.workOrder.findFirst({
    where: { companyId: company.id, orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  let nextSeq = 101;
  if (lastOrder?.orderNumber) {
    const parts = lastOrder.orderNumber.split("-");
    const lastSeq = Number(parts[2] ?? "0");
    if (Number.isFinite(lastSeq) && lastSeq >= 101) nextSeq = lastSeq + 1;
  }

  // Kreiraj dovoljno aparata (max 10 * 6 = 60)
  const totalItems = workingDays.length * 6;
  const existingSim = await prisma.extinguisher.count({
    where: { companyId: company.id, internalCode: { startsWith: "SIM-" } },
  });
  const toCreate = totalItems - existingSim;
  if (toCreate > 0) {
    const start = existingSim + 1;
    for (let i = start; i <= existingSim + toCreate; i++) {
      const code = `SIM-${three(i)}`;
      await prisma.extinguisher.upsert({
        where: { companyId_internalCode: { companyId: company.id, internalCode: code } },
        create: {
          companyId: company.id,
          internalCode: code,
          serialNumber: `SN-${code}`,
          productionYear: 2020 + (i % 5),
          manufacturerId: manufacturer.id,
          extinguisherTypeId: type.id,
          status: "ACTIVE",
        },
        update: {},
      });
    }
    console.log("  Aparati (SIM-xxx):", toCreate, "novih");
  }

  const extinguishers = await prisma.extinguisher.findMany({
    where: { companyId: company.id, internalCode: { startsWith: "SIM-" } },
    orderBy: { internalCode: "asc" },
    select: { id: true, internalCode: true },
  });
  if (extinguishers.length < totalItems) {
    throw new Error(`Nema dovoljno aparata (treba ${totalItems}, ima ${extinguishers.length}).`);
  }

  let extinguisherIndex = 0;
  let labelCounter = 0;

  for (let i = 0; i < workingDays.length; i++) {
    const receivedAt = workingDays[i];
    receivedAt.setHours(10, 0, 0, 0);
    const orderNumber = makeOrderNumber(receivedAt, nextSeq + i);
    const numItems = 2 + (i % 5); // 2 do 6

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
        receivedQty: numItems,
        items: {
          create: Array.from({ length: numItems }, (_, j) => {
            const ext = extinguishers[extinguisherIndex++];
            labelCounter++;
            const servicer = servicers[j % servicers.length];
            return {
              companyId: company.id,
              isPlaceholder: false,
              extinguisherId: ext.id,
              servicerId: servicer.id,
              labelNumber: `LBL-SIM-${three(labelCounter)}`,
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

    // Ažuriraj aparate (lastPeriodicAt, nextPeriodicDue, lastInternalAt, nextInternalDue)
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

    // Zaključaj nalog
    await prisma.workOrder.update({
      where: { id: order.id },
      data: { status: "LOCKED", lockedAt: new Date(), lockedById: lockUser.id },
    });

    console.log("  Nalog", orderNumber, "–", numItems, "aparata, datum", receivedAt.toISOString().slice(0, 10));
  }

  console.log("✅ Gotovo: 10 radnih naloga kreirano i zaključano.");
}

main()
  .catch((e) => {
    console.error("❌ Greška:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
