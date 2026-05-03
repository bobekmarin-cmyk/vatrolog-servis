import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSession } from "@/lib/auth";
import { apiHandler, AppValidationError } from "@/lib/apiHandler";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  serviceLabelId: z.string().min(5).max(60),
  minStockQty: z.coerce.number().int().min(0).max(1_000_000),
});

export const POST = apiHandler(async (req: Request) => {
  const session = await requireActiveSession();
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AppValidationError("Neispravan unos.");
  }

  const { serviceLabelId, minStockQty } = parsed.data;

  const label = await prisma.serviceLabel.findUnique({
    where: { id: serviceLabelId },
    select: { id: true },
  });
  if (!label) {
    throw new AppValidationError("Naljepnica nije pronađena.");
  }

  await prisma.serviceLabelStock.upsert({
    where: {
      companyId_serviceLabelId: {
        companyId: session.companyId,
        serviceLabelId,
      },
    },
    create: {
      companyId: session.companyId,
      serviceLabelId,
      stockQty: 0,
      minStockQty,
    },
    update: {
      minStockQty,
    },
  });

  return NextResponse.json({ ok: true });
});
