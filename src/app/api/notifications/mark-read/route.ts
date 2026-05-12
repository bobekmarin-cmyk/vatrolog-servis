import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markAllRead, markRead } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });
  }
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Nemate ovlasti." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    notificationId?: string;
    all?: boolean;
  };

  if (body.all === true) {
    await markAllRead(session.accountUserId);
    return NextResponse.json({ ok: true });
  }

  const id = String(body.notificationId ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "notificationId je obavezan." }, { status: 400 });
  }

  await markRead({ notificationId: id, accountUserId: session.accountUserId });
  return NextResponse.json({ ok: true });
}
