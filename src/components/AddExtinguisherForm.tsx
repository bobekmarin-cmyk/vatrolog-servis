"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import ExtinguisherTypeCombobox from "@/components/ExtinguisherTypeCombobox";
import LoadingOverlay from "@/components/LoadingOverlay";
import QRCode from "qrcode";

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

type LookupResult =
  | { status: "idle" }
  | { status: "checking" }
  | {
      status: "found";
      extinguisher: {
        id: string;
        internalCode: string;
        serialNumber: string;
        productionYear: number;
        manufacturerId: string;
        extinguisherTypeId: string;
        manufacturerName: string | null;
        typeName: string | null;
      };
    }
  | { status: "not_found" };

export default function AddExtinguisherForm(props: {
  orderId: string;
  itemId: string;
  title?: string;
  subtitle?: string;
  manufacturers: Manufacturer[];
  types: ExtinguisherType[];
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
    embedded = false,
    formId,
    focusRef,
    onSuccess,
    onCancel,
    onCanSubmitChange,
    onSubmittingChange,
  } = props;

  const router = useRouter();

  const [internalCode, setInternalCode] = useState<string>("");
  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });

  const [manufacturerId, setManufacturerId] = useState<string>("");
  const [extinguisherTypeId, setExtinguisherTypeId] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [productionYear, setProductionYear] = useState<string>("");
  const [typeDescription, setTypeDescription] = useState<string>("");
  const [serviceLocationText, setServiceLocationText] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ preview internog broja (kad je internalCode prazno)
  const [previewCode, setPreviewCode] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string>("");

  const debounceRef = useRef<number | null>(null);

  const canSubmit = useMemo(() => {
    // Ako korisnik upisuje interni broj: mora postojati
    if (internalCode.trim().length > 0) {
      return lookup.status === "found";
    }

    // Inače: ručni unos obaveznih polja
    return (
      manufacturerId.trim().length > 0 &&
      extinguisherTypeId.trim().length > 0 &&
      serialNumber.trim().length > 0 &&
      productionYear.trim().length > 0
    );
  }, [internalCode, lookup.status, manufacturerId, extinguisherTypeId, serialNumber, productionYear]);

  useEffect(() => {
    onCanSubmitChange?.(canSubmit && !submitting);
  }, [canSubmit, submitting, onCanSubmitChange]);

  useEffect(() => {
    onSubmittingChange?.(submitting);
  }, [submitting, onSubmittingChange]);

  const qrCodeValue = useMemo(() => {
    if (lookup.status === "found") return lookup.extinguisher.internalCode;
    if (internalCode.trim().length > 0) return internalCode.trim();
    if (previewCode.trim().length > 0) return previewCode.trim();
    return "";
  }, [lookup, internalCode, previewCode]);

  useEffect(() => {
    let cancelled = false;
    if (!qrCodeValue) {
      queueMicrotask(() => {
        if (!cancelled) setQrPreviewDataUrl("");
      });
      return () => {
        cancelled = true;
      };
    }
    QRCode.toDataURL(qrCodeValue, {
      margin: 1,
      width: 160,
      errorCorrectionLevel: "M",
    })
      .then((url: string) => {
        if (!cancelled) setQrPreviewDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrPreviewDataUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [qrCodeValue]);

  // Live lookup po internom broju
  useEffect(() => {
    const code = internalCode.trim();

    if (!code) {
      queueMicrotask(() => setLookup({ status: "idle" }));
      return;
    }

    queueMicrotask(() => setLookup({ status: "checking" }));

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/extinguishers/lookup?internalCode=${encodeURIComponent(code)}`);
        const data = await res.json();

        if (data?.found && data?.extinguisher) {
          setLookup({ status: "found", extinguisher: data.extinguisher });

          // ✅ Auto-popuni polja
          setManufacturerId(String(data.extinguisher.manufacturerId || ""));
          setExtinguisherTypeId(String(data.extinguisher.extinguisherTypeId || ""));
          setSerialNumber(String(data.extinguisher.serialNumber || ""));
          setProductionYear(String(data.extinguisher.productionYear || ""));

          return;
        }

        setLookup({ status: "not_found" });
      } catch {
        setLookup({ status: "not_found" });
      }
    }, 250);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [internalCode]);

  // ✅ Preview internog broja: čim odabereš tip (težinu), a internalCode je prazno
  useEffect(() => {
    const codeEmpty = internalCode.trim().length === 0;

    if (!codeEmpty || lookup.status === "found") {
      queueMicrotask(() => setPreviewCode(""));
      return;
    }

    if (!extinguisherTypeId) {
      queueMicrotask(() => setPreviewCode(""));
      return;
    }

    let cancelled = false;
    queueMicrotask(() => setPreviewLoading(true));

    fetch(
      `/api/extinguishers/next-internal-code?extinguisherTypeId=${encodeURIComponent(extinguisherTypeId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data?.suggested) setPreviewCode(String(data.suggested));
        else setPreviewCode("");
      })
      .catch(() => {
        if (cancelled) return;
        setPreviewCode("");
      })
      .finally(() => {
        if (cancelled) return;
        setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [extinguisherTypeId, internalCode, lookup.status]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !canSubmit) return;

    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/work-orders/${orderId}/items/${itemId}/fill`, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Spremanje aparata nije uspjelo.");
        return;
      }
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/work-orders/${orderId}`);
        router.refresh();
      }
    } catch {
      setError("Greška mreže — aparat nije spremljen.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {submitting && !embedded ? (
        <LoadingOverlay title="Spremam aparat..." message="Molimo pričekajte, otvara se servisni nalog." />
      ) : null}
      <form
        id={formId}
        className={embedded ? "space-y-5" : "surface space-y-5 p-5 sm:p-6"}
        onSubmit={handleSubmit}
      >
      {title ? (
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          {error}
        </div>
      ) : null}

      {/* Interni broj */}
      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-white p-4 ring-1 ring-black/[0.03]">
        <label className="label">Interni broj (opcionalno)</label>

        <div className="mt-1 flex items-center gap-2">
          <input
            name="internalCode"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            className="input w-full font-mono"
            placeholder="npr. 0100900001"
            autoComplete="off"
          />

          <div className="flex h-10 w-10 shrink-0 items-center justify-center">
            {lookup.status === "checking" && (
              <span className="text-slate-400" title="Provjeravam…">…</span>
            )}
            {lookup.status === "found" && (
              <span className="text-emerald-600" title="Interni broj postoji">✔</span>
            )}
            {lookup.status === "not_found" && (
              <span className="text-rose-600" title="Interni broj ne postoji">✖</span>
            )}
          </div>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Ako upišeš interni broj, sustav mora pronaći postojeći aparat i automatski će popuniti polja ispod.
          Ako nema internog broja, ostavi prazno — novi broj dodjeljuje se automatski u formatu šifra servisa (2) + težina (3) + redni broj (5), npr. 0100300001.
        </p>

        {internalCode.trim().length === 0 && extinguisherTypeId && lookup.status !== "found" && (
          <div className="mt-3 text-xs text-slate-700">
            {previewLoading ? (
              <span className="text-slate-400">Predloženi interni broj: …</span>
            ) : previewCode ? (
              <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm">
                Predloženi interni broj:{" "}
                <span className="font-mono text-sm font-semibold text-slate-900">{previewCode}</span>
              </span>
            ) : null}
          </div>
        )}

        {lookup.status === "found" && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            Nađen aparat: <span className="font-mono">{lookup.extinguisher.internalCode}</span>
            {lookup.extinguisher.typeName ? ` · ${lookup.extinguisher.typeName}` : ""}
            {lookup.extinguisher.manufacturerName ? ` · ${lookup.extinguisher.manufacturerName}` : ""}
          </div>
        )}

        {lookup.status === "not_found" && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            Interni broj nije pronađen. Ako je to novi aparat, ostavi polje prazno i unesi podatke ručno.
          </div>
        )}

        {qrCodeValue && qrPreviewDataUrl ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <Image
              src={qrPreviewDataUrl}
              alt={`QR ${qrCodeValue}`}
              width={72}
              height={72}
              unoptimized
              className="rounded-md"
            />
            <div className="min-w-0 text-xs">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                QR (interni broj)
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900">{qrCodeValue}</div>
              <div className="mt-1 text-slate-500">
                Naljepnicu možeš ispisati kasnije iz popisa aparata.
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="add-ext-manufacturer">
            Proizvođač
          </label>
          <select
            id="add-ext-manufacturer"
            ref={focusRef as RefObject<HTMLSelectElement | null> | undefined}
            name="manufacturerId"
            className="select"
            required={internalCode.trim().length === 0}
            value={manufacturerId}
            onChange={(e) => {
              const nextId = e.target.value;
              setManufacturerId(nextId);
              setExtinguisherTypeId("");
            }}
            disabled={lookup.status === "found"}
          >
            <option value="">-- odaberi --</option>
            {manufacturers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className={embedded ? "space-y-4" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
          <div>
            <label className="label">Tip aparata</label>
            {(() => {
              const selectedM = manufacturers.find((m) => m.id === manufacturerId);
              const allowedIds = selectedM
                ? new Set((selectedM.supportedTypes ?? []).map((s) => s.extinguisherTypeId))
                : null;
              const visibleTypes = allowedIds ? types.filter((t) => allowedIds.has(t.id)) : [];
              const noTypesForManufacturer = !!selectedM && visibleTypes.length === 0;
              return (
                <div className="space-y-2">
                  <ExtinguisherTypeCombobox
                    name="extinguisherTypeId"
                    value={extinguisherTypeId}
                    onChange={setExtinguisherTypeId}
                    options={visibleTypes}
                    required={internalCode.trim().length === 0}
                    disabled={lookup.status === "found" || !selectedM || noTypesForManufacturer}
                    placeholder={selectedM ? "-- odaberi --" : "Prvo odaberi proizvođača"}
                  />
                  {noTypesForManufacturer ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      Ovaj proizvođač nema unesene tipove aparata. Odaberi drugog proizvođača ili se javi vendoru.
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>

          <div>
            <label className="label">Dodatni opis tipa (opcionalno)</label>
            <input
              name="typeDescription"
              className="input"
              value={typeDescription}
              onChange={(e) => setTypeDescription(e.target.value)}
              placeholder="npr. P6+, P2A, FX6"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
          <div>
            <label className="label" htmlFor="add-ext-serial">
              Serijski broj
            </label>
            <input
              id="add-ext-serial"
              name="serialNumber"
              className="input"
              required={internalCode.trim().length === 0}
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              disabled={lookup.status === "found"}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="label" htmlFor="add-ext-year">
              Godina proizvodnje
            </label>
            <input
              id="add-ext-year"
              name="productionYear"
              type="number"
              className="input"
              required={internalCode.trim().length === 0}
              min={1900}
              max={2099}
              pattern="(19|20)[0-9]{2}"
              value={productionYear}
              onChange={(e) => setProductionYear(e.target.value)}
              disabled={lookup.status === "found"}
              autoComplete="off"
            />
          </div>
        </div>

        <div>
          <label className="label">Lokacija (opcionalno)</label>
          <input
            name="serviceLocationText"
            className="input"
            value={serviceLocationText}
            onChange={(e) => setServiceLocationText(e.target.value)}
          />
        </div>
      </div>

      {embedded ? null : (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            className={[
              "btn px-5",
              canSubmit && !submitting ? "btn-primary" : "cursor-not-allowed bg-slate-200 text-slate-500",
            ].join(" ")}
            type="submit"
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Spremam…" : "Spremi"}
          </button>

          {onCancel ? (
            <button type="button" className="btn btn-outline px-5" onClick={onCancel}>
              Odustani
            </button>
          ) : (
            <Link className="btn btn-outline px-5" href={`/work-orders/${orderId}`}>
              Odustani
            </Link>
          )}
        </div>
      )}
      </form>
    </>
  );
}
