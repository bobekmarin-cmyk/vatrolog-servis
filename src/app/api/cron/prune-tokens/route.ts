import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardCronRequest } from "@/lib/cronAuth";
import { logInfo } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Briše istekle AuthToken zapise (password reset, email verify, invites).
 * Tokene koje su iskorišteni čuva 30 dana radi forenzike.
 */
export async function GET(req: Request): Promise<Response> {
  const denied = guardCronRequest(req);
  if (denied) return denied;

  const now = new Date();
  const usedCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const expired = await prisma.authToken.deleteMany({
    where: {
      OR: [
        { usedAt: null, expiresAt: { lt: now } },
        { usedAt: { lt: usedCutoff } },
      ],
    },
  });

  logInfo("cron_prune_tokens_done", { deleted: expired.count });
  return NextResponse.json({ ok: true, deleted: expired.count });
}
