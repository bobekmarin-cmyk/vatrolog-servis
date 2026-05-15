import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

/** Analitika servisera premještena u Izvještaji → Servisna analitika. */
export default async function ServicerAnalyticsRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");
  const { id } = await params;
  redirect(`/reports/operations/servicer/${id}`);
}
