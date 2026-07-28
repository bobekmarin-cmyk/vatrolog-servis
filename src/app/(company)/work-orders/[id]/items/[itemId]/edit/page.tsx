import { redirect } from "next/navigation";

/**
 * Stari puni ekran „Uredi podatke aparata”. Izmjena se sada radi u draweru na
 * nalogu, pa stari link samo otvara nalog s parametrima koji podignu drawer.
 */
export default async function EditItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  redirect(`/work-orders/${id}?item=${itemId}&mode=edit`);
}
