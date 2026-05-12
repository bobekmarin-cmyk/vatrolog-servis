import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";

export const runtime = "nodejs";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export async function GET() {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const cats = await prisma.notificationCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { notifications: true } } },
  });
  return NextResponse.json({ categories: cats });
}

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Naziv je obavezan." }, { status: 400 });

  const slugRaw = typeof body.slug === "string" ? body.slug.trim() : "";
  const slug = (slugRaw || slugify(name)).slice(0, 64);
  if (!slug) return NextResponse.json({ error: "Slug nije moguće generirati." }, { status: 400 });

  const exists = await prisma.notificationCategory.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json({ error: `Slug "${slug}" već postoji.` }, { status: 409 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  const color = typeof body.color === "string" ? body.color.trim() : null;
  const isUpdate = !!body.isUpdate;
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0;

  const cat = await prisma.notificationCategory.create({
    data: {
      slug,
      name,
      description: description || null,
      color: color || null,
      isUpdate,
      sortOrder,
    },
  });
  return NextResponse.json({ category: cat }, { status: 201 });
}
