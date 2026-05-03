import { WorkOrderStatus } from "@prisma/client";

export default function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const isDone = status === "LOCKED";

  return (
    <span
      className={[
        "badge badge-tight whitespace-nowrap",
        isDone ? "badge-success" : "badge-info",
      ].join(" ")}
      title={isDone ? "Servis završen" : "Servis u tijeku"}
    >
      {isDone ? "Servis završen" : "Servis u tijeku"}
    </span>
  );
}

