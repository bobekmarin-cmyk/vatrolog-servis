"use client";

import { useMemo, useState } from "react";

export type WoLocationOption = {
  id: string;
  kind: "STATIONARY" | "VEHICLE";
  label: string;
};

type DeliveryChoice = "CUSTOMER" | "SERVISER";

export default function WorkOrderLocationDeliveryPicker({
  locations,
  sessionLocationId,
  isAdmin,
  initialLocationId,
}: {
  locations: WoLocationOption[];
  /** Workshop: lokacija vezana uz račun; admin: uvijek null u smislu zaključavanja gumba */
  sessionLocationId: string | null;
  isAdmin: boolean;
  /** Već izračunat na serveru (izbjegava hydration mismatch). */
  initialLocationId: string;
}) {
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  const [locationId, setLocationId] = useState(initialLocationId);
  const selected = byId.get(locationId);
  const isStationary = selected?.kind === "STATIONARY";

  const [deliveryMode, setDeliveryMode] = useState<DeliveryChoice>("CUSTOMER");

  function lockedForAccount(locId: string): boolean {
    if (isAdmin) return false;
    if (!sessionLocationId) return false;
    return locId !== sessionLocationId;
  }

  if (locations.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Nema aktivnih servisnih lokacija. Dodaj lokacije pri kreiranju tvrtke ili putem platforme.
      </div>
    );
  }

  // Dinamički font: cilj je da uvijek bude vidljivo barem ~10 znakova labele.
  // Kratke labele dobivaju standardni text-xs (12px), duže se postupno smanjuju.
  function labelFontClass(label: string): string {
    const len = label.length;
    if (len <= 10) return "text-xs";          // 12px - sve stane bez problema
    if (len <= 14) return "text-[11px]";      // tighter
    return "text-[10px]";                      // dugačke labele - i dalje ~10+ znakova vidljivo
  }

  return (
    <div className="space-y-3">
      <label className="label">Servisna lokacija</label>
      <input type="hidden" name="serviceLocationId" value={locationId} />
      <input
        type="hidden"
        name="deliveryMode"
        value={isStationary ? deliveryMode : ""}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {locations.map((loc) => {
          const active = locationId === loc.id;
          const disabled = lockedForAccount(loc.id);
          const tooltip = disabled
            ? "Ovaj servis vidite samo sa svoje lokacije. Prijavite se odgovarajućim korisnikom."
            : loc.label;
          return (
            <button
              key={loc.id}
              type="button"
              title={tooltip}
              aria-disabled={disabled}
              disabled={disabled}
              className={[
                "btn h-10 w-full min-w-0 px-2 flex items-center justify-start gap-1.5",
                active ? "btn-primary" : "btn-outline",
                disabled ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
              onClick={() => {
                if (!disabled) setLocationId(loc.id);
              }}
            >
              <span
                className={`badge badge-tight shrink-0 ${loc.kind === "STATIONARY" ? "badge-info" : "badge-success"}`}
              >
                {loc.kind === "STATIONARY" ? "S" : "V"}
              </span>
              <span
                className={`font-medium leading-tight truncate ${labelFontClass(loc.label)}`}
              >
                {loc.label}
              </span>
            </button>
          );
        })}
      </div>

      {isStationary ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            className={[
              "btn h-9 w-full px-3 text-sm",
              deliveryMode === "CUSTOMER" ? "btn-primary" : "btn-outline",
            ].join(" ")}
            onClick={() => setDeliveryMode("CUSTOMER")}
          >
            Dostavlja kupac
          </button>
          <button
            type="button"
            className={[
              "btn h-9 w-full px-3 text-sm",
              deliveryMode === "SERVISER" ? "btn-primary" : "btn-outline",
            ].join(" ")}
            onClick={() => setDeliveryMode("SERVISER")}
          >
            Preuzima serviser
          </button>
        </div>
      ) : (
        <p className="help text-sm">
          Servis u vozilu - na lokaciji kupca
        </p>
      )}
    </div>
  );
}
