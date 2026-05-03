import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { APP_VERSION } from "@/lib/appVersion";
import { logError } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint. Vraća 200 ako je baza dostupna, 503 inače.
 * Koristi se za uptime monitoring (BetterStack, UptimeRobot) i container healthchecks.
 *
 * Endpoint je javan (middleware ga propušta kroz /api/health) — ne smije
 * vraćati interne detalje (poruke iz baze, stack trace itd.). Greške se
 * loggiraju serverski.
 */
export async function GET() {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - started;
    return NextResponse.json(
      {
        ok: true,
        version: APP_VERSION,
        db: { ok: true, latencyMs: dbMs },
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    );
  } catch (err) {
    logError("health_check_db_failed", err);
    return NextResponse.json(
      {
        ok: false,
        version: APP_VERSION,
        db: { ok: false },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
