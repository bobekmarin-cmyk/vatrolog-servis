export function customerDisplayName(
  customer: { shortName?: string | null; name: string } | null | undefined,
): string {
  if (!customer) return "—";
  const short = String(customer.shortName ?? "").trim();
  return short || customer.name;
}

