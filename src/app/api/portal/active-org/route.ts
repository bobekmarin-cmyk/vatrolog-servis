import { NextResponse } from "next/server";
import { getOwnerSession, OWNER_ORG_COOKIE } from "@/lib/ownerAuth";
import { getOwnerMembershipOrgs, touchMembershipAccess } from "@/lib/ownerOrg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Postavi aktivni subjekt (tvrtku) za prijavljenog vlasnika. */
export async function POST(req: Request): Promise<Response> {
  const session = await getOwnerSession();
  if (!session) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  let ownerOrgId: string | null = null;
  try {
    const body = (await req.json()) as { ownerOrgId?: string };
    ownerOrgId = typeof body.ownerOrgId === "string" ? body.ownerOrgId : null;
  } catch {
    ownerOrgId = null;
  }
  if (!ownerOrgId) return NextResponse.json({ error: "Nedostaje tvrtka." }, { status: 400 });

  const orgs = await getOwnerMembershipOrgs(session.ownerId);
  if (!orgs.some((o) => o.ownerOrgId === ownerOrgId)) {
    return NextResponse.json({ error: "Nemate pristup ovoj tvrtki." }, { status: 403 });
  }

  await touchMembershipAccess(session.ownerId, ownerOrgId);

  const res = NextResponse.json({ ok: true, redirect: "/korisnik" });
  res.cookies.set(OWNER_ORG_COOKIE, ownerOrgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
