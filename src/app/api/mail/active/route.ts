import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getTenantMailStatus,
  setActiveTenantMailProvider,
  type MailProvider,
} from "@/lib/tenantMail";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { provider?: unknown };
  const raw = body.provider;
  let provider: MailProvider | null;
  if (raw === null || raw === "AUTO" || raw === "") {
    provider = null;
  } else if (raw === "GMAIL" || raw === "SMTP") {
    provider = raw;
  } else {
    return NextResponse.json(
      { error: "Provider mora biti 'GMAIL', 'SMTP' ili 'AUTO'." },
      { status: 400 },
    );
  }

  // Provjeri da je odabrani provider stvarno konfiguriran
  if (provider) {
    const status = await getTenantMailStatus(session.companyId);
    if (provider === "GMAIL" && !status.gmail.configured) {
      return NextResponse.json(
        { error: "Gmail nije povezan, ne mogu ga postaviti kao aktivnog." },
        { status: 400 },
      );
    }
    if (provider === "SMTP" && !status.smtp.configured) {
      return NextResponse.json(
        { error: "SMTP nije konfiguriran, ne mogu ga postaviti kao aktivnog." },
        { status: 400 },
      );
    }
  }

  await setActiveTenantMailProvider(session.companyId, provider);
  return NextResponse.json({ ok: true });
}
