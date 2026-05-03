import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platformAuth";
import { isVendorConnected, sendVendorGmail } from "@/lib/platformGmail";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

const Body = z.object({
  to: z.string().email("Neispravan email."),
  subject: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ps = await getPlatformSession();
  if (!ps) return NextResponse.json({ error: "Niste prijavljeni." }, { status: 401 });

  const ipKey = clientKeyFromRequest(req);
  const rl = await checkRateLimit("platformGmailTestSend", `${ps.platformUserId}:${ipKey}`, {
    limit: 5,
    windowSec: 60,
  });
  if (rl.blocked) {
    return NextResponse.json(
      { error: `Previše pokušaja. Pokušaj ponovno za ${rl.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (e: any) {
    return NextResponse.json({ error: e?.errors?.[0]?.message ?? "Neispravan zahtjev." }, { status: 400 });
  }

  if (!(await isVendorConnected())) {
    return NextResponse.json({ error: "Vendor Gmail nije spojen." }, { status: 400 });
  }

  const subject = body.subject ?? "VatroLog: testni mail";
  const html = `
<!doctype html>
<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937">
  <h2 style="color:#dc2626;margin:0 0 12px">VatroLog testni mail</h2>
  <p>Ovo je testna poruka iz platform postavki. Ako je vidiš, vendor Gmail integracija radi.</p>
  <p style="font-size:12px;color:#6b7280">Poslano u ${new Date().toLocaleString("hr-HR")}</p>
</body></html>`;

  let sentOk = false;
  let errMsg: string | null = null;
  try {
    await sendVendorGmail({ to: body.to, subject, html });
    sentOk = true;
  } catch (e: any) {
    errMsg = (e?.message ?? "Slanje neuspješno").toString().slice(0, 500);
  }

  await prisma.emailLog.create({
    data: {
      toEmail: body.to,
      subject,
      htmlBody: html,
      kind: "VENDOR_TEST",
      transport: sentOk ? "VENDOR_GMAIL" : null,
      status: sentOk ? "SENT" : "FAILED",
      error: errMsg,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "PLATFORM",
      action: "platform.gmail.test-send",
      entity: "PlatformIntegration",
      entityId: "GMAIL",
      meta: { to: body.to, ok: sentOk, error: errMsg },
    },
  });

  if (!sentOk) {
    return NextResponse.json({ error: errMsg ?? "Slanje neuspješno." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
