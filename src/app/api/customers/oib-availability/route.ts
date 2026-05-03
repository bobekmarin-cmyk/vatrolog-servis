import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isValidCroatianOib } from "@/schemas/common";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const oib = String(searchParams.get("oib") ?? "").replace(/\D/g, "");
  const excludeCustomerId = String(searchParams.get("excludeCustomerId") ?? "").trim();

  if (!isValidCroatianOib(oib)) {
    return NextResponse.json({ error: "OIB nije valjan." }, { status: 400 });
  }

  const existing = await prisma.customer.findFirst({
    where: {
      companyId: session.companyId,
      oib,
      ...(excludeCustomerId ? { NOT: { id: excludeCustomerId } } : {}),
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    available: !existing,
    existingCustomer: existing ?? null,
  });
}

