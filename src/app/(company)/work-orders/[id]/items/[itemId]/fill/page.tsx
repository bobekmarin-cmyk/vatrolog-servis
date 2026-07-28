import { redirect } from "next/navigation";

/**
 * Stari puni ekran „Popuni placeholder”. Unos se sada radi u draweru na nalogu,
 * pa stari link samo otvara nalog s parametrima koji podignu drawer.
 */
export default async function FillItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  redirect(`/work-orders/${id}?item=${itemId}&mode=fill`);
}
