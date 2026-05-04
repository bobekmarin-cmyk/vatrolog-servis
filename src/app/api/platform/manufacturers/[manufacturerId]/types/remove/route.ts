import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";
import { syncCompanyServiceCatalog } from "@/lib/companyServiceCatalog";

import { redirectRelative } from "@/lib/httpRedirect";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ manufacturerId: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { manufacturerId } = await params;
  const form = await req.formData();
  const extinguisherTypeId = String(form.get("extinguisherTypeId") ?? "").trim();
  if (!extinguisherTypeId) {
    return NextResponse.json({ error: "Nedostaje extinguisherTypeId." }, { status: 400 });
  }

  const typeBefore = await prisma.extinguisherType.findUnique({
    where: { id: extinguisherTypeId },
    select: { id: true, code: true, name: true },
  });
  if (!typeBefore) {
    return NextResponse.json({ error: "Tip aparata nije pronađen." }, { status: 404 });
  }

  let cascadedExtinguishers = 0;
  let nullifiedWorkOrderItems = 0;
  let hardDeletedType = false;

  // Cijela operacija u transakciji da se ne ostavi konzistentno polovično stanje.
  await prisma.$transaction(async (tx) => {
    // 1) Skini link manufacturer ↔ tip.
    await tx.manufacturerExtinguisherType.deleteMany({
      where: { manufacturerId, extinguisherTypeId },
    });

    // 2) Provjeri preostale link-ove.
    const remainingLinks = await tx.manufacturerExtinguisherType.count({
      where: { extinguisherTypeId },
    });

    // 3) Ako je tip ostao orphan, force-cascade brisanje (po user policy).
    if (remainingLinks === 0) {
      const exIds = (
        await tx.extinguisher.findMany({
          where: { extinguisherTypeId },
          select: { id: true },
        })
      ).map((e) => e.id);

      if (exIds.length > 0) {
        const woi = await tx.workOrderItem.updateMany({
          where: { extinguisherId: { in: exIds } },
          data: { extinguisherId: null },
        });
        nullifiedWorkOrderItems = woi.count;

        const ex = await tx.extinguisher.deleteMany({
          where: { id: { in: exIds } },
        });
        cascadedExtinguishers = ex.count;
      }

      await tx.extinguisherType.delete({ where: { id: extinguisherTypeId } });
      hardDeletedType = true;
    }

    // 4) Full sync — prune-a katalog kod svih tvrtki za varijantu kojoj
    //    više ne odgovara nijedan live tip.
    await syncCompanyServiceCatalog(tx, {});
  });

  // 5) Audit log (izvan transakcije, fire-and-forget logika).
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "PLATFORM",
        action: "platform.extinguisher_type.unlink",
        entity: "ExtinguisherType",
        entityId: extinguisherTypeId,
        meta: {
          manufacturerId,
          typeCode: typeBefore.code,
          typeName: typeBefore.name,
          hardDeletedType,
          cascadedExtinguishers,
          nullifiedWorkOrderItems,
        },
      },
    });
  } catch {
    // audit ne smije rušiti operaciju
  }

  // Ako klijent traži JSON, vrati strukturiran odgovor s upozorenjem.
  const wantsJson = req.headers.get("accept")?.includes("application/json");
  if (wantsJson) {
    return NextResponse.json({
      ok: true,
      hardDeletedType,
      cascadedExtinguishers,
      nullifiedWorkOrderItems,
      warning:
        cascadedExtinguishers > 0
          ? `Obrisano ${cascadedExtinguishers} aparata jer je posljednji proizvođač uklonjen za tip ${typeBefore.code}.`
          : null,
    });
  }

  return redirectRelative(`/platform/manufacturers/${manufacturerId}`, 303);
}
