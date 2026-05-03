import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/lib/platformAuth";

export default async function PlatformCompanyFeaturesRedirect({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  await requirePlatformSession();
  const { companyId } = await params;
  redirect(`/platform/companies/${companyId}`);
}
