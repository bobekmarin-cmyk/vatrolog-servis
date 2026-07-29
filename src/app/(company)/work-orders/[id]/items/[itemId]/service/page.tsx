import { redirect } from "next/navigation";

/**
 * Servis se od sada otvara u draweru na stranici naloga. Stara ruta ostaje
 * radi bookmarkova i preusmjerava na nalog s otvorenim drawerom.
 */
export default async function ServiceItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  redirect(`/work-orders/${id}?item=${encodeURIComponent(itemId)}&mode=service`);
}
