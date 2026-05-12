import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getTenantMailStatus,
  sendTenantMail,
  TenantMailNotConfiguredError,
  TenantMailSendError,
} from "@/lib/tenantMail";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { to?: unknown };
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !/^.+@.+\..+$/.test(to)) {
    return NextResponse.json({ error: "Neispravna e-mail adresa primatelja." }, { status: 400 });
  }

  const status = await getTenantMailStatus(session.companyId);
  if (!status.smtp.configured) {
    return NextResponse.json({ error: "SMTP nije konfiguriran." }, { status: 400 });
  }

  const html = `<!DOCTYPE html><html lang="hr"><body style="font-family:Arial,sans-serif;color:#0f172a;padding:24px;max-width:600px;">
    <h2 style="margin:0 0 12px;">VatroLog — test SMTP integracije</h2>
    <p>Ovo je testna poruka poslana iz Postavki maila.</p>
    <p>Ako ste primili ovu poruku, vaša SMTP integracija ispravno radi i možete slati obavijesti kupcima.</p>
    <p style="color:#64748b;font-size:12px;margin-top:24px;">Poslano u ${new Date().toLocaleString("hr-HR")}.</p>
  </body></html>`;

  try {
    const result = await sendTenantMail({
      companyId: session.companyId,
      to,
      subject: "[TEST] VatroLog SMTP integracija",
      html,
      text: "Ovo je testna poruka poslana iz VatroLog Postavki maila.",
      forceProvider: "SMTP",
    });
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      fromAddress: result.fromAddress,
      messageId: result.messageId,
    });
  } catch (err) {
    if (err instanceof TenantMailNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof TenantMailSendError) {
      return NextResponse.json(
        { error: "Slanje nije uspjelo.", detail: err.message },
        { status: 500 },
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Greška: " + msg }, { status: 500 });
  }
}
