import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { isUpdatePayload } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type PatchBody = {
  categoryId?: string;
  title?: string;
  summary?: string | null;
  body?: string;
  pinned?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatePayload?: unknown;
};

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.notification.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Obavijest nije pronađena." }, { status: 404 });
  }

  const payload = (await req.json().catch(() => ({}))) as PatchBody;

  const data: Prisma.NotificationUncheckedUpdateInput = {};
  let nextCategoryIsUpdate = existing.category.isUpdate;

  if (typeof payload.categoryId === "string" && payload.categoryId !== existing.categoryId) {
    const cat = await prisma.notificationCategory.findUnique({ where: { id: payload.categoryId } });
    if (!cat) return NextResponse.json({ error: "Kategorija ne postoji." }, { status: 404 });
    data.categoryId = payload.categoryId;
    nextCategoryIsUpdate = cat.isUpdate;
  }

  if (typeof payload.title === "string") {
    const t = payload.title.trim();
    if (!t) return NextResponse.json({ error: "Naslov je obavezan." }, { status: 400 });
    data.title = t;
  }

  if (typeof payload.summary !== "undefined") {
    data.summary =
      typeof payload.summary === "string" && payload.summary.trim()
        ? payload.summary.trim()
        : null;
  }
  if (typeof payload.body === "string") {
    data.body = payload.body;
  }
  if (typeof payload.pinned === "boolean") {
    data.pinned = payload.pinned;
  }
  if (typeof payload.status === "string") {
    const next = payload.status;
    if (next !== "DRAFT" && next !== "PUBLISHED" && next !== "ARCHIVED") {
      return NextResponse.json({ error: "Nepoznat status." }, { status: 400 });
    }
    data.status = next;
    if (next === "PUBLISHED" && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  if (typeof payload.updatePayload !== "undefined") {
    if (nextCategoryIsUpdate) {
      if (!isUpdatePayload(payload.updatePayload)) {
        return NextResponse.json(
          { error: "Update payload je obavezan za Ažuriranja." },
          { status: 400 },
        );
      }
      data.updatePayload = payload.updatePayload as unknown as Prisma.InputJsonValue;
    } else {
      data.updatePayload = Prisma.JsonNull;
    }
  } else if (data.categoryId && !nextCategoryIsUpdate && existing.updatePayload != null) {
    data.updatePayload = Prisma.JsonNull;
  }

  await prisma.notification.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { id } = await params;
  await prisma.notification.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
