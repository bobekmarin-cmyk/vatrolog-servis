"use client";

import Link from "next/link";
import { useState } from "react";
import ExtinguisherTypeCombobox from "@/components/ExtinguisherTypeCombobox";
import PendingSubmitForm from "@/components/PendingSubmitForm";

type Manufacturer = {
  id: string;
  name: string;
  supportedTypes?: { extinguisherTypeId: string }[];
};
type ExtinguisherType = {
  id: string;
  name: string;
  code: string;
  agent?: { code: string; label: string; symbol?: string | null } | null;
  construction?: { code: string; label: string } | null;
};

export default function EditExtinguisherForm(props: {
  orderId: string;
  itemId: string;
  title: string;
  subtitle: string;
  manufacturers: Manufacturer[];
  types: ExtinguisherType[];
  initial: {
    internalCode: string;
    manufacturerId: string;
    extinguisherTypeId: string;
    serialNumber: string;
    productionYear: number;
    typeDescription: string | null;
    serviceLocationText: string | null;
  };
}) {
  const {
    orderId,
    itemId,
    title,
    subtitle,
    manufacturers,
    types,
    initial,
  } = props;

  const [manufacturerId, setManufacturerId] = useState(initial.manufacturerId);
  const [extinguisherTypeId, setExtinguisherTypeId] = useState(initial.extinguisherTypeId);

  const selectedM = manufacturers.find((m) => m.id === manufacturerId);
  const allowedIds =
    selectedM?.supportedTypes && selectedM.supportedTypes.length > 0
      ? new Set(selectedM.supportedTypes.map((s) => s.extinguisherTypeId))
      : null;
  const visibleTypes = allowedIds
    ? types.filter((t) => allowedIds.has(t.id))
    : types;

  return (
    <PendingSubmitForm
      className="surface space-y-4 p-4"
      action={`/api/work-orders/${orderId}/items/${itemId}/update-extinguisher`}
      method="post"
      pendingTitle="Spremam promjene..."
      pendingMessage="Molimo pričekajte, otvara se servisni nalog."
    >
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <p className="mt-1 text-xs text-slate-500">
          Interni broj: <span className="font-mono">{initial.internalCode}</span> (nije moguće mijenjati)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Proizvođač</label>
          <select
            name="manufacturerId"
            className="select"
            required
            value={manufacturerId}
            onChange={(e) => {
              const next = e.target.value;
              setManufacturerId(next);
              const m = manufacturers.find((x) => x.id === next);
              if (m?.supportedTypes && m.supportedTypes.length > 0) {
                const allowed = new Set(m.supportedTypes.map((s) => s.extinguisherTypeId));
                if (extinguisherTypeId && !allowed.has(extinguisherTypeId)) {
                  setExtinguisherTypeId("");
                }
              }
            }}
          >
            <option value="">-- odaberi --</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Tip aparata</label>
          <ExtinguisherTypeCombobox
            name="extinguisherTypeId"
            value={extinguisherTypeId}
            onChange={setExtinguisherTypeId}
            options={visibleTypes}
            required
          />
        </div>

        <div>
          <label className="label">Serijski broj</label>
          <input
            name="serialNumber"
            className="input"
            required
            defaultValue={initial.serialNumber}
          />
        </div>

        <div>
          <label className="label">Dodatni opis tipa (opcionalno)</label>
          <input
            name="typeDescription"
            className="input"
            defaultValue={initial.typeDescription ?? ""}
            placeholder="npr. P6+, P2A, FX6"
          />
        </div>

        <div>
          <label className="label">Godina proizvodnje</label>
          <input
            name="productionYear"
            type="number"
            className="input"
            required
            min={1900}
            max={2099}
            pattern="(19|20)[0-9]{2}"
            defaultValue={initial.productionYear}
          />
        </div>
      </div>

      <div>
        <label className="label">Lokacija (opcionalno)</label>
        <input
          name="serviceLocationText"
          className="input"
          defaultValue={initial.serviceLocationText ?? ""}
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button className="btn btn-primary px-4" type="submit">
          Spremi promjene
        </button>
        <Link className="btn btn-outline px-4" href={`/work-orders/${orderId}`}>
          Odustani
        </Link>
      </div>
    </PendingSubmitForm>
  );
}
