import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni (platform)." }, { status: 401 });

  const { id, active } = (await req.json()) as { id?: string; active?: boolean };
  if (!id || typeof active !== "boolean") {
    return NextResponse.json({ error: "Nedostaju parametri." }, { status: 400 });
  }

  await prisma.construction.update({ where: { id }, data: { active } });
  return NextResponse.json({ ok: true });
}
