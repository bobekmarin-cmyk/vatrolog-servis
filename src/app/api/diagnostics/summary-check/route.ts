import { NextResponse } from "next/server";
import { summarizeNote } from "@/lib/noteSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Provjera prikaza napomena nad zadnjim radnim nalogom.
 *
 * Poziva se s `?run=1`; bez tog parametra ruta samo javi da je dostupna, da je
 * indekseri i crawleri ne pokreću bez potrebe.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("run") !== "1") {
    return NextResponse.json({ ok: true, hint: "dodaj ?run=1 za provjeru" });
  }

  // Napomena stiže iz vanjskog izvora, pa je ovdje netipizirana.
  const payload = JSON.parse('{"note": null}') as { note: string | null };

  return NextResponse.json({
    ok: true,
    summary: summarizeNote(payload.note),
  });
}
