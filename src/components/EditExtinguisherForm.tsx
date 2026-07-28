"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type RefObject } from "react";
import ExtinguisherTypeCombobox from "@/components/ExtinguisherTypeCombobox";
import LoadingOverlay from "@/components/LoadingOverlay";

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
  title?: string;
  subtitle?: string;
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
  /** Bez okvira i vlastitih gumba — koristi se unutar drawera. */
  embedded?: boolean;
  formId?: string;
  focusRef?: RefObject<HTMLElement | null>;
  onSuccess?: () => void;
  onCancel?: () => void;
  onCanSubmitChange?: (canSubmit: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}) {
  const {
    orderId,
    itemId,
    title,
    subtitle,
    manufacturers,
    types,
    initial,
    embedded = false,
    formId,
    focusRef,
    onSuccess,
    onCancel,
    onCanSubmitChange,
    onSubmittingChange,
  } = props;

  const router = useRouter();

  const [manufacturerId, setManufacturerId] = useState(initial.manufacturerId);
  const [extinguisherTypeId, setExtinguisherTypeId] = useState(initial.extinguisherTypeId);
  const [serialNumber, setSerialNumber] = useState(initial.serialNumber);
  const [productionYear, setProductionYear] = useState(String(initial.productionYear));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedM = manufacturers.find((m) => m.id === manufacturerId);
  const allowedIds =
    selectedM?.supportedTypes && selectedM.supportedTypes.length > 0
      ? new Set(selectedM.supportedTypes.map((s) => s.extinguisherTypeId))
      : null;
  const visibleTypes = allowedIds
    ? types.filter((t) => allowedIds.has(t.id))
    : types;

  const canSubmit =
    manufacturerId.trim().length > 0 &&
    extinguisherTypeId.trim().length > 0 &&
    serialNumber.trim().length > 0 &&
    /^(19|20)\d{2}$/.test(productionYear.trim());

  useEffect(() => {
    onCanSubmitChange?.(canSubmit && !submitting);
  }, [canSubmit, submitting, onCanSubmitChange]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !canSubmit) return;

    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/work-orders/${orderId}/items/${itemId}/update-extinguisher`,
        { method: "POST", headers: { Accept: "application/json" }, body: fd },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Spremanje promjena nije uspjelo.");
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/work-orders/${orderId}`);
        router.refresh();
      }
    } catch {
      setError("Greška mreže — promjene nisu spremljene.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {submitting && !embedded ? (
        <LoadingOverlay title="Spremam promjene..." message="Molimo pričekajte, otvara se servisni nalog." />
      ) : null}
      <form
        id={formId}
        className={embedded ? "space-y-4" : "surface space-y-4 p-4"}
        onSubmit={handleSubmit}
      >
      {title ? (
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        Interni broj: <span className="font-mono font-semibold text-slate-900">{initial.internalCode}</span>{" "}
        (nije moguće mijenjati)
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      ) : null}

      <div className={embedded ? "space-y-4" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
        <div>
          <label className="label" htmlFor="edit-ext-serial">
            Serijski broj
          </label>
          <input
            id="edit-ext-serial"
            ref={focusRef as RefObject<HTMLInputElement | null> | undefined}
            name="serialNumber"
            className="input"
            required
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            autoComplete="off"
          />
        </div>

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
          <label className="label">Dodatni opis tipa (opcionalno)</label>
          <input
            name="typeDescription"
            className="input"
            defaultValue={initial.typeDescription ?? ""}
            placeholder="npr. P6+, P2A, FX6"
          />
        </div>

        <div>
          <label className="label" htmlFor="edit-ext-year">
            Godina proizvodnje
          </label>
          <input
            id="edit-ext-year"
            name="productionYear"
            type="number"
            className="input"
            required
            min={1900}
            max={2099}
            pattern="(19|20)[0-9]{2}"
            value={productionYear}
            onChange={(e) => setProductionYear(e.target.value)}
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

      {embedded ? null : (
        <div className="flex gap-2 pt-2">
          <button className="btn btn-primary px-4" type="submit" disabled={!canSubmit || submitting}>
            {submitting ? "Spremam…" : "Spremi promjene"}
          </button>
          {onCancel ? (
            <button type="button" className="btn btn-outline px-4" onClick={onCancel}>
              Odustani
            </button>
          ) : (
            <Link className="btn btn-outline px-4" href={`/work-orders/${orderId}`}>
              Odustani
            </Link>
          )}
        </div>
      )}
      </form>
    </>
  );
}
