import { PrismaClient, WorkOrderStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) throw new Error("No company found");

  const customers = await prisma.customer.findMany({ where: { companyId: company.id }, take: 5 });
  if (customers.length === 0) throw new Error("No customers found");

  const servicers = await prisma.user.findMany({ where: { companyId: company.id, role: "SERVISER" } });
  const manufacturer = await prisma.manufacturer.findFirst();
  const extType = await prisma.extinguisherType.findFirst();

  if (!manufacturer || !extType) throw new Error("Need at least one manufacturer and extinguisher type");

  const now = new Date();
  const orderConfigs = [
    { num: "26-04-010", status: WorkOrderStatus.IN_PROGRESS, serviced: [0, 1, 2], locked: false, dueDays: 3 },
    { num: "26-04-011", status: WorkOrderStatus.IN_PROGRESS, serviced: [0, 1, 2, 3], locked: false, dueDays: 1 },
    { num: "26-04-012", status: WorkOrderStatus.LOCKED, serviced: [0, 1, 2, 3, 4], locked: true, dueDays: -2 },
    { num: "26-04-013", status: WorkOrderStatus.IN_PROGRESS, serviced: [0], locked: false, dueDays: 5 },
    { num: "26-04-014", status: WorkOrderStatus.LOCKED, serviced: [0, 1, 2], locked: true, dueDays: -1 },
  ];

  for (let oi = 0; oi < orderConfigs.length; oi++) {
    const cfg = orderConfigs[oi];
    const customer = customers[oi % customers.length];

    const existing = await prisma.workOrder.findFirst({
      where: { companyId: company.id, orderNumber: cfg.num },
    });
    if (existing) {
      console.log(`Skipping ${cfg.num} (already exists)`);
      continue;
    }

    const dueAt = new Date(now.getTime() + cfg.dueDays * 24 * 60 * 60 * 1000);
    const receivedAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const order = await prisma.workOrder.create({
      data: {
        companyId: company.id,
        orderNumber: cfg.num,
        status: cfg.locked ? WorkOrderStatus.LOCKED : cfg.status,
        customerId: customer.id,
        receivedAt,
        dueAt,
        deliveryMode: "CUSTOMER",
        receivedQty: 5,
        lockedAt: cfg.locked ? now : null,
      },
    });

    for (let i = 0; i < 5; i++) {
      const isServiced = cfg.serviced.includes(i);
      const serial = `SN-${cfg.num}-${i + 1}`;
      const internalCode = `${extType.code}-${String(oi * 100 + i + 1).padStart(4, "0")}`;

      const ext = await prisma.extinguisher.create({
        data: {
          companyId: company.id,
          internalCode,
          serialNumber: serial,
          productionYear: 2020 + (i % 4),
          manufacturerId: manufacturer.id,
          extinguisherTypeId: extType.id,
          status: "ACTIVE",
        },
      });

      const servicer = servicers.length > 0 ? servicers[i % servicers.length] : null;
      const servicedAt = isServiced
        ? new Date(now.getTime() - (5 - i) * 24 * 60 * 60 * 1000 + i * 3600000)
        : null;

      await prisma.workOrderItem.create({
        data: {
          companyId: company.id,
          workOrderId: order.id,
          extinguisherId: ext.id,
          isPlaceholder: false,
          servicedAt,
          servicerId: isServiced && servicer ? servicer.id : null,
          periodicDone: isServiced,
          labelNumber: isServiced ? `LBL-${oi + 1}-${i + 1}` : null,
          nextPeriodicDue: isServiced ? new Date(now.getFullYear() + 1, now.getMonth(), 1) : null,
        },
      });
    }

    console.log(`Created ${cfg.num} — ${cfg.serviced.length}/5 serviced, locked=${cfg.locked}`);
  }

  console.log("Done!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
