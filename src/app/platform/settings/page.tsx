import { requirePlatformSession } from "@/lib/platformAuth";
import { getVendorStatus } from "@/lib/platformGmail";
import { getPlatformSettings } from "@/lib/platformSettings";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; gmail?: string; reason?: string }>;
}) {
  await requirePlatformSession();
  const sp = await searchParams;

  const [vendor, settings] = await Promise.all([getVendorStatus(), getPlatformSettings()]);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Postavke</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vendor mail integracija, branding sistemskih mailova i health pregled.
        </p>
      </div>

      <SettingsClient
        initialTab={(sp.tab ?? "email") as any}
        gmailFlash={sp.gmail ?? null}
        gmailReason={sp.reason ?? null}
        vendor={{
          connected: vendor.connected,
          email: vendor.email,
          connectedAt: vendor.connectedAt ? vendor.connectedAt.toISOString() : null,
          expiresAt: vendor.expiresAt ? vendor.expiresAt.toISOString() : null,
          scope: vendor.scope,
        }}
        branding={{
          defaultFromName: settings?.defaultFromName ?? null,
          defaultFromEmail: settings?.defaultFromEmail ?? null,
          signatureHtml: settings?.signatureHtml ?? null,
          logoUrl: settings?.logoUrl ?? null,
          brandColor: settings?.brandColor ?? null,
        }}
      />
    </main>
  );
}
