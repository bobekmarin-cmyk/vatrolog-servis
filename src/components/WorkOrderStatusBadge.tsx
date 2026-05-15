import { WorkOrderStatus } from "@prisma/client";

export default function WorkOrderStatusBadge({
  status,
  hasShippedDeliveryNote,
}: {
  status: WorkOrderStatus;
  /** Kad je nalog zaključan: true ako postoji aktivna izdana otpremnica (PDF spremljen). */
  hasShippedDeliveryNote?: boolean;
}) {
  const inProgress = status !== "LOCKED";
  const shipped = status === "LOCKED" && !!hasShippedDeliveryNote;

  let label: string;
  let title: string;
  let cls: string;

  if (inProgress) {
    label = "Servis u tijeku";
    title = "Nalog nije zaključen.";
    cls = "badge-info";
  } else if (shipped) {
    label = "Otpremljeno";
    title = "Nalog je zaključen i otpremnica je izdana.";
    cls = "badge-success";
  } else {
    label = "Servis završen";
    title = "Nalog je zaključen; otpremnica još nije izdana.";
    cls = "badge-warning";
  }

  return (
    <span className={["badge badge-tight whitespace-nowrap", cls].join(" ")} title={title}>
      {label}
    </span>
  );
}
