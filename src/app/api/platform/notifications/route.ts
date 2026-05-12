import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { isUpdatePayload } from "@/lib/notifications";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type PostBody = {
  categoryId?: string;
  title?: string;
  summary?: string | null;
  body?: string;
  pinned?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatePayload?: unknown;
};

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const payload = (await req.json().catch(() => ({}))) as PostBody;
  const categoryId = String(payload.categoryId ?? "").trim();
  const title = String(payload.title ?? "").trim();
  if (!categoryId) return NextResponse.json({ error: "Kategorija je obavezna." }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Naslov je obavezan." }, { status: 400 });

  const cat = await prisma.notificationCategory.findUnique({ where: { id: categoryId } });
  if (!cat) return NextResponse.json({ error: "Kategorija ne postoji." }, { status: 404 });

  const status: "DRAFT" | "PUBLISHED" | "ARCHIVED" = payload.status === "PUBLISHED"
    ? "PUBLISHED"
    : payload.status === "ARCHIVED"
      ? "ARCHIVED"
      : "DRAFT";

  let updateJson: Prisma.InputJsonValue | undefined = undefined;
  if (cat.isUpdate) {
    if (!isUpdatePayload(payload.updatePayload)) {
      return NextResponse.json(
        { error: "Update payload je obavezan i mora sadržavati version i sections." },
        { status: 400 },
      );
    }
    updateJson = payload.updatePayload as unknown as Prisma.InputJsonValue;
  }

  const data: Prisma.NotificationUncheckedCreateInput = {
    categoryId,
    title,
    summary: typeof payload.summary === "string" && payload.summary.trim() ? payload.summary.trim() : null,
    body: typeof payload.body === "string" ? payload.body : "",
    pinned: !!payload.pinned,
    status,
    publishedAt: status === "PUBLISHED" ? new Date() : null,
    authorPlatformUserId: ps.platformUserId,
  };
  if (updateJson !== undefined) data.updatePayload = updateJson;

  const created = await prisma.notification.create({ data, select: { id: true } });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
