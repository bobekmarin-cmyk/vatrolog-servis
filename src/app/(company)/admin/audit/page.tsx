import { redirect } from "next/navigation";

export default async function LegacyAuditRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else if (typeof value === "string") {
      qs.set(key, value);
    }
  }
  const query = qs.toString();
  redirect(`/admin/settings/audit${query ? `?${query}` : ""}`);
}
