import { getSession } from "@/lib/auth";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import { redirect } from "next/navigation";

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const features = await getCompanyFeatures(session.companyId);
  const allowed = isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.REPORTS_MONTHLY);
  if (!allowed) redirect("/?forbidden=1");

  return children;
}

