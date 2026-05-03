import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import AdminSettingsTabs from "@/components/AdminSettingsTabs";
import { redirect } from "next/navigation";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/?forbidden=1");

  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.ADMIN_SETTINGS);
  if (!allowed) redirect("/?forbidden=1");

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Postavke</h1>
        <p className="mt-1 text-sm text-slate-600">Postavke tvrtke, serviseri i rezervni dijelovi.</p>
      </div>

      <section className="surface">
        <div className="surface-body p-0">
          <AdminSettingsTabs />
          <div className="p-4">{children}</div>
        </div>
      </section>
    </main>
  );
}

