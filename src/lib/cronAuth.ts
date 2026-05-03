import { NextResponse } from "next/server";

/**
 * Provjerava da cron ruta pozvana iz Vercel Cron-a (ili ručno iz CI-a)
 * nosi `Authorization: Bearer ${CRON_SECRET}` header. U produkciji bez
 * postavljenog CRON_SECRET-a ruta se ne može pozvati.
 *
 * Vraća null ako je OK, ili NextResponse (401/503) ako nije.
 */
export function guardCronRequest(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET nije postavljen u okruženju.", code: "CRON_NOT_CONFIGURED" },
        { status: 503 },
      );
    }
    // U dev-u dozvoli bez secreta radi lakšeg testiranja.
    return null;
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  // Vercel Cron šalje `Authorization: Bearer <CRON_SECRET>` automatski.
  if (authHeader === expected) return null;

  // Dopusti i `x-cron-secret` zaglavlje za ručno pozivanje (curl s npx jobs).
  const altHeader = req.headers.get("x-cron-secret") ?? "";
  if (altHeader === secret) return null;

  return NextResponse.json({ error: "Nedozvoljen pristup cron ruti." }, { status: 401 });
}
