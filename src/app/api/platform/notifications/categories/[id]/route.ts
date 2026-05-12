import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const data: {
    name?: string;
    description?: string | null;
    color?: string | null;
    isUpdate?: boolean;
    active?: boolean;
    sortOrder?: number;
  } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.description === "string") data.description = body.description.trim() || null;
  if (typeof body.color === "string") data.color = body.color.trim() || null;
  if (typeof body.isUpdate === "boolean") data.isUpdate = body.isUpdate;
  if (typeof body.active === "boolean") data.active = body.active;
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nema promjena za spremiti." }, { status: 400 });
  }

  try {
    const cat = await prisma.notificationCategory.update({ where: { id }, data });
    return NextResponse.json({ category: cat });
  } catch {
    return NextResponse.json({ error: "Kategorija nije pronađena." }, { status: 404 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { id } = await params;
  const used = await prisma.notification.count({ where: { categoryId: id } });
  if (used > 0) {
    return NextResponse.json(
      {
        error: `Kategorija ima ${used} povezanih obavijesti — najprije ih premjestite ili obrišite.`,
      },
      { status: 409 },
    );
  }

  try {
    await prisma.notificationCategory.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Kategorija nije pronađena." }, { status: 404 });
  }
}
