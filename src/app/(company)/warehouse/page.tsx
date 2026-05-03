import { redirect } from "next/navigation";

/**
 * Zastarjeli ulaz — skladište dijelova je na /warehouse/parts kako naljepnice
 * (/warehouse/labels) nisu hijerarhijski "pod" istim indeksom.
 */
export default function WarehouseRedirectPage() {
  redirect("/warehouse/parts");
}
