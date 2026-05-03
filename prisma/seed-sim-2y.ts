/**
 * Simulacija: 40 primki + radnih naloga raspoređenih unazad 2 godine.
 * Neki aparati vrijede (imaju nextPeriodicDue u budućnosti), neki su istekli.
 * Lanci servisa: dio aparata servisiran u godini 1 (2024) i godini 2 (2025),
 * dio samo u jednoj godini — što stvara realističan miks za "popis po mjesecima".
 *
 * Prefiks internih šifri: SIM2Y-xxxx
 * Prefiks naljepnica:     SIM2Y-Lxxxx
 * Brojevi naloga:         yy-mm-5xx (izbjegava sudar s postojećim)
 *
 * Pokretanje:
 *   npx ts-node -P tsconfig.seed.json prisma/seed-sim-2y.ts
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const PREFIX_INTERNAL = "SIM2Y-";
const PREFIX_LABEL = "SIM2Y-L";
const TOTAL_ORDERS = 40;
const MONTHS_BACK = 24;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function pad3(n: number) {
  return String(n).padStart(3, "0");
}
function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function mulberry32(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260415);
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function lastDayOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addMonths(d: Date, n: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth() + n,
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

/** Zadnji dan mjeseca servisa + 12 mjeseci (PP ciklus). */
function calcNextPeriodicDue(serviceDate: Date): Date {
  const y = serviceDate.getFullYear();
  const m = serviceDate.getMonth();
  const d = new Date(y + 1, m + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function workingDayIn(year: number, month: number, dayOfMonth: number): Date {
  const d = new Date(year, month, dayOfMonth, 10, 0, 0, 0);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
    if (d.getMonth() !== month) {
      d.setDate(dayOfMonth - 1);
      while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      break;
    }
  }
  return d;
}

type ExtMeta = {
  id: string;
  customerId: string;
  nextPeriodicDue: Date | null;
};

async function main() {
  console.log("Simulacija: 40 naloga unazad 2 godine...");

  const company = await prisma.company.findFirst();
  if (!company) throw new Error("Nema tvrtke. Pokreni: npx prisma db seed");

  let customers = await prisma.customer.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  // Ako je premalo kupaca, dodaj simulirane (SIM2Y-) da popis po mjesecima ima raspršenost.
  const MIN_CUSTOMERS = 8;
  if (customers.length < MIN_CUSTOMERS) {
    const simNames = [
      { name: "Kos Transporti d.o.o.", city: "Zagreb", oib: "11111111101" },
      { name: "Vatrostalni Pogon d.d.", city: "Split", oib: "11111111102" },
      { name: "Adria Logistika d.o.o.", city: "Rijeka", oib: "11111111103" },
      { name: "Jadran Servis j.d.o.o.", city: "Pula", oib: "11111111104" },
      { name: "Sigurnost Plus d.o.o.", city: "Osijek", oib: "11111111105" },
      { name: "Tehno Gradnja d.o.o.", city: "Varaždin", oib: "11111111106" },
      { name: "Pekara Stari Mlin", city: "Zadar", oib: "11111111107" },
      { name: "Hotel Kvarner Resort", city: "Opatija", oib: "11111111108" },
      { name: "Autoservis Matić", city: "Zagreb", oib: "11111111109" },
      { name: "Gradski Vrtići Sunce", city: "Karlovac", oib: "11111111110" },
    ];
    const needed = MIN_CUSTOMERS - customers.length;
    let added = 0;
    for (const nc of simNames) {
      if (added >= needed) break;
      const exists = await prisma.customer.findFirst({
        where: { companyId: company.id, oib: nc.oib },
        select: { id: true },
      });
      if (exists) continue;
      await prisma.customer.create({
        data: {
          companyId: company.id,
          type: "LEGAL",
          name: nc.name,
          oib: nc.oib,
          address: `${nc.city}, simulirana adresa`,
          city: nc.city,
          autoNotify: true,
        },
      });
      added++;
    }
    if (added > 0) {
      console.log(`  Dodao ${added} simuliranih kupaca.`);
      customers = await prisma.customer.findMany({
        where: { companyId: company.id },
        orderBy: { createdAt: "asc" },
        take: 12,
      });
    }
  }
  if (customers.length < 3) {
    throw new Error(`Potrebno je barem 3 kupca (pronađeno: ${customers.length}).`);
  }
  console.log(`  Koristim ${customers.length} kupaca.`);

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
  if (!lockUser) throw new Error("Nema korisnika za zaključavanje.");

  const manufacturers = await prisma.manufacturer.findMany({
    include: { supportedTypes: { select: { extinguisherTypeId: true } } },
  });
  if (manufacturers.length === 0) throw new Error("Nema proizvođača.");
  const allTypes = await prisma.extinguisherType.findMany({ select: { id: true } });
  if (allTypes.length === 0) throw new Error("Nema tipova aparata.");

  type Pair = { manufacturerId: string; extinguisherTypeId: string };
  const pairs: Pair[] = [];
  for (const m of manufacturers) {
    const ids = m.supportedTypes.map((s) => s.extinguisherTypeId);
    const usable = ids.length > 0 ? ids : allTypes.map((t) => t.id);
    for (const tid of usable) pairs.push({ manufacturerId: m.id, extinguisherTypeId: tid });
  }

  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Plan raspodjele naloga po mjesecima (offset = broj mjeseci unazad od trenutnog):
  // - 5 u trenutnom mjesecu (da vidimo "X od Y" odrađeno + nepreuzete)
  // - 4 u prošlom mjesecu
  // - nekoliko u mjesecima prije 9-11 mjeseci (stvara aparate koji su sad rokovi u budućim mjesecima)
  // - 6 u istom mjesecu prošle godine (offset 12) — njihovi aparati dolaze sad u trenutni mjesec
  // - ostatak rasut kroz starije mjesece (offset 13..23) — razni stupnjevi istekla
  const offsets: number[] = [];
  for (let i = 0; i < 5; i++) offsets.push(0);
  for (let i = 0; i < 4; i++) offsets.push(1);
  for (let i = 0; i < 3; i++) offsets.push(11);
  for (let i = 0; i < 3; i++) offsets.push(10);
  for (let i = 0; i < 2; i++) offsets.push(9);
  for (let i = 0; i < 6; i++) offsets.push(12);
  for (let i = 0; i < 5; i++) offsets.push(13 + randInt(0, 6));
  for (let i = 0; i < 4; i++) offsets.push(20 + randInt(0, 3));
  while (offsets.length < TOTAL_ORDERS) offsets.push(randInt(2, MONTHS_BACK - 1));
  offsets.length = TOTAL_ORDERS;
  offsets.sort((a, b) => b - a); // najstariji prvo

  const extMeta = new Map<string, ExtMeta>();
  let extinguisherCounter = 0;

  const existingSim2y = await prisma.extinguisher.count({
    where: { companyId: company.id, internalCode: { startsWith: PREFIX_INTERNAL } },
  });
  extinguisherCounter = existingSim2y;

  let labelCounter = 0;
  const existingLabels = await prisma.workOrderItem.count({
    where: { companyId: company.id, labelNumber: { startsWith: PREFIX_LABEL } },
  });
  labelCounter = existingLabels;

  const monthSeqCache = new Map<string, number>();
  async function getNextSeq(monthKey: string): Promise<number> {
    let seq = monthSeqCache.get(monthKey);
    if (seq === undefined) {
      const last = await prisma.workOrder.findFirst({
        where: { companyId: company!.id, orderNumber: { startsWith: monthKey + "-" } },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      seq = 500;
      if (last?.orderNumber) {
        const parts = last.orderNumber.split("-");
        const n = Number(parts[2] ?? "0");
        if (Number.isFinite(n) && n > seq) seq = n;
      }
    }
    seq += 1;
    monthSeqCache.set(monthKey, seq);
    return seq;
  }

  let totalItems = 0;
  let totalServiced = 0;
  let totalNewExts = 0;

  for (let idx = 0; idx < TOTAL_ORDERS; idx++) {
    const offset = offsets[idx];
    const monthDate = addMonths(currentMonth, -offset);
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const receivedAt = workingDayIn(year, month, randInt(3, 25));

    const customer = pick(customers);
    const itemCount = randInt(5, 25);

    const monthStart = firstDayOfMonth(monthDate);
    const monthEnd = lastDayOfMonth(monthDate);

    // Aparati istog kupca čiji nextPeriodicDue pada u ovaj mjesec (returning pool).
    const returningPool: ExtMeta[] = [];
    for (const meta of extMeta.values()) {
      if (meta.customerId !== customer.id) continue;
      if (!meta.nextPeriodicDue) continue;
      if (meta.nextPeriodicDue >= monthStart && meta.nextPeriodicDue <= monthEnd) {
        returningPool.push(meta);
      }
    }
    const maxReturning = Math.min(returningPool.length, Math.ceil(itemCount * 0.75));
    const minReturning = Math.max(0, Math.floor(maxReturning * 0.4));
    const returningCount = randInt(minReturning, maxReturning);
    const shuffledReturning = shuffle(returningPool);
    const chosenReturning = shuffledReturning.slice(0, returningCount);
    const newCount = itemCount - chosenReturning.length;

    const yy = String(year).slice(-2);
    const mm = pad2(month + 1);
    const monthKey = `${yy}-${mm}`;
    const seq = await getNextSeq(monthKey);
    const orderNumber = `${monthKey}-${pad3(seq)}`;

    // Kreiraj nove aparate.
    const newExtMetas: ExtMeta[] = [];
    for (let i = 0; i < newCount; i++) {
      extinguisherCounter++;
      const p = pick(pairs);
      const code = `${PREFIX_INTERNAL}${pad4(extinguisherCounter)}`;
      const ext = await prisma.extinguisher.create({
        data: {
          companyId: company.id,
          internalCode: code,
          serialNumber: `SN-${code}`,
          productionYear: 2018 + randInt(0, 7),
          manufacturerId: p.manufacturerId,
          extinguisherTypeId: p.extinguisherTypeId,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const meta: ExtMeta = {
        id: ext.id,
        customerId: customer.id,
        nextPeriodicDue: null,
      };
      extMeta.set(ext.id, meta);
      newExtMetas.push(meta);
    }
    totalNewExts += newCount;

    // Status: najstariji uvijek LOCKED; trenutni mjesec miks DRAFT/IN_PROGRESS/LOCKED.
    const isCurrentMonth = offset === 0;
    const isRecent = offset <= 1;
    let status: "DRAFT" | "IN_PROGRESS" | "LOCKED";
    if (isCurrentMonth) {
      const r = rand();
      status = r < 0.35 ? "LOCKED" : r < 0.8 ? "IN_PROGRESS" : "DRAFT";
    } else if (isRecent) {
      status = rand() < 0.7 ? "LOCKED" : "IN_PROGRESS";
    } else {
      status = "LOCKED";
    }

    const allItems = [...chosenReturning, ...newExtMetas];

    // Odluka o servisiranju po stavci:
    // LOCKED -> svi servisirani; IN_PROGRESS -> ~40% servisirano; DRAFT -> 0% servisirano.
    const serviceDecisions = allItems.map(() => {
      if (status === "LOCKED") return true;
      if (status === "DRAFT") return false;
      return rand() < 0.4;
    });

    const servicedAt = receivedAt;
    const newNextPeriodicDue = calcNextPeriodicDue(servicedAt);

    const itemsData: Prisma.WorkOrderItemCreateWithoutWorkOrderInput[] = allItems.map((meta, j) => {
      labelCounter++;
      const isServiced = serviceDecisions[j];
      const servicer = servicers[randInt(0, servicers.length - 1)];
      const targetPM = meta.nextPeriodicDue ?? monthStart;
      const doInternal = isServiced && rand() < 0.22;
      return {
        company: { connect: { id: company.id } },
        isPlaceholder: false,
        extinguisher: { connect: { id: meta.id } },
        servicer: { connect: { id: servicer.id } },
        labelNumber: `${PREFIX_LABEL}${pad4(labelCounter)}`,
        servicedAt: isServiced ? servicedAt : null,
        periodicDone: isServiced,
        internalDone: doInternal,
        internalDoneAt: doInternal ? servicedAt : null,
        nextPeriodicDue: isServiced ? newNextPeriodicDue : null,
        nextInternalDue: null,
        targetPeriodicMonth: targetPM,
      };
    });

    const workOrder = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber,
        status,
        customerId: customer.id,
        receivedAt,
        dueAt: receivedAt,
        startedAt: receivedAt,
        finishedAt: status === "LOCKED" ? servicedAt : null,
        deliveryMode: rand() < 0.5 ? "CUSTOMER" : "SERVISER",
        receivedQty: itemCount,
        items: { create: itemsData },
      },
      select: { id: true },
    });

    // Ažuriraj aparate za servisirane stavke.
    for (let i = 0; i < allItems.length; i++) {
      if (!serviceDecisions[i]) continue;
      const meta = allItems[i];
      await prisma.extinguisher.update({
        where: { id: meta.id },
        data: {
          lastPeriodicAt: servicedAt,
          nextPeriodicDue: newNextPeriodicDue,
        },
      });
      meta.nextPeriodicDue = newNextPeriodicDue;
      totalServiced++;
    }

    if (status === "LOCKED") {
      await prisma.workOrder.update({
        where: { id: workOrder.id },
        data: { lockedAt: new Date(), lockedById: lockUser.id },
      });
    }

    totalItems += itemCount;
    console.log(
      `[${pad2(idx + 1)}/${TOTAL_ORDERS}] ${orderNumber} ${status.padEnd(11)} ${customer.name.slice(0, 28).padEnd(28)} items=${pad2(itemCount)} (R:${pad2(chosenReturning.length)} N:${pad2(newCount)}) date=${receivedAt.toISOString().slice(0, 10)}`,
    );
  }

  // Sažetak.
  const curMonthStart = firstDayOfMonth(currentMonth);
  const curMonthEnd = lastDayOfMonth(currentMonth);
  let dueCurrent = 0;
  let overdue = 0;
  let futureValid = 0;
  for (const m of extMeta.values()) {
    if (!m.nextPeriodicDue) continue;
    if (m.nextPeriodicDue < curMonthStart) overdue++;
    else if (m.nextPeriodicDue <= curMonthEnd) dueCurrent++;
    else futureValid++;
  }

  console.log("\n=== Sažetak ===");
  console.log(`Naloga: ${TOTAL_ORDERS}  |  Primki: ${TOTAL_ORDERS}  |  Ukupno stavki: ${totalItems}`);
  console.log(`Novi aparati (SIM2Y-): ${totalNewExts}  |  Servisiranih stavki: ${totalServiced}`);
  console.log(`\nStanje aparata (SIM2Y-) po PP roku:`);
  console.log(`  Rok u trenutnom mjesecu: ${dueCurrent}`);
  console.log(`  Istekli rokovi:          ${overdue}`);
  console.log(`  Rok u budućnosti:        ${futureValid}`);
}

main()
  .catch((e) => {
    console.error("Greška:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
