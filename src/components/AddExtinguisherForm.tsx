"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import ExtinguisherTypeCombobox from "@/components/ExtinguisherTypeCombobox";
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
  title: string;
  subtitle: string;
  manufacturers: Manufacturer[];
  types: ExtinguisherType[];
}) {
  const { orderId, itemId, title, subtitle, manufacturers, types } = props;

  const [internalCode, setInternalCode] = useState<string>("");
  const [lookup, setLookup] = useState<LookupResult>({ status: "idle" });

  const [manufacturerId, setManufacturerId] = useState<string>("");
  const [extinguisherTypeId, setExtinguisherTypeId] = useState<string>("");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [productionYear, setProductionYear] = useState<string>("");
  const [typeDescription, setTypeDescription] = useState<string>("");
  const [serviceLocationText, setServiceLocationText] = useState<string>("");

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

  const qrCodeValue = useMemo(() => {
    if (lookup.status === "found") return lookup.extinguisher.internalCode;
    if (internalCode.trim().length > 0) return internalCode.trim();
    if (previewCode.trim().length > 0) return previewCode.trim();
    return "";
  }, [lookup, internalCode, previewCode]);

  useEffect(() => {
    let cancelled = false;
    if (!qrCodeValue) {
      setQrPreviewDataUrl("");
      return;
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
      setLookup({ status: "idle" });
      return;
    }

    setLookup({ status: "checking" });

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

    // Ako je user unio interni broj ili je aparat pronađen → preview nema smisla
    if (!codeEmpty || lookup.status === "found") {
      setPreviewCode("");
      return;
    }

    if (!extinguisherTypeId) {
      setPreviewCode("");
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);

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

  return (
    <form
      className="surface space-y-4 p-4"
      action={`/api/work-orders/${orderId}/items/${itemId}/fill`}
      method="post"
    >
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      </div>

      {/* Interni broj */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
        <label className="label">Interni broj (opcionalno)</label>

        <div className="mt-1 flex items-center gap-2">
          <input
            name="internalCode"
            value={internalCode}
            onChange={(e) => setInternalCode(e.target.value)}
            className="input w-full font-mono"
            placeholder="npr. 10090001"
            autoComplete="off"
          />

          <div className="h-10 w-10 flex items-center justify-center">
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

        <p className="mt-1 text-xs text-slate-500">
          Ako upišeš interni broj, sustav mora pronaći postojeći aparat i automatski će popuniti polja ispod.
          Ako nema internog broja, ostavi prazno — novi broj dodjeljuje se automatski u formatu servis + količina + redni broj (npr. 10090001).
        </p>

        {/* ✅ Preview internog broja */}
        {internalCode.trim().length === 0 && extinguisherTypeId && lookup.status !== "found" && (
          <div className="mt-2 text-xs text-slate-700">
            {previewLoading ? (
              <span className="text-slate-400">Predloženi interni broj: …</span>
            ) : previewCode ? (
              <span className="inline-flex items-center gap-2 rounded border border-black/10 bg-white px-2 py-1">
                Predloženi interni broj: <span className="font-mono font-semibold">{previewCode}</span>
              </span>
            ) : null}
          </div>
        )}

        {lookup.status === "found" && (
          <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
            Nađen aparat: <span className="font-mono">{lookup.extinguisher.internalCode}</span>
            {lookup.extinguisher.typeName ? ` · ${lookup.extinguisher.typeName}` : ""}
            {lookup.extinguisher.manufacturerName ? ` · ${lookup.extinguisher.manufacturerName}` : ""}
          </div>
        )}

        {lookup.status === "not_found" && (
          <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
            Interni broj nije pronađen. Ako je to novi aparat, ostavi polje prazno i unesi podatke ručno.
          </div>
        )}

        {qrCodeValue && qrPreviewDataUrl ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
            <div className="text-xs text-slate-600">QR (interni broj)</div>
            <div className="mt-1 flex items-center gap-3">
              <img
                src={qrPreviewDataUrl}
                alt={`QR ${qrCodeValue}`}
                width={72}
                height={72}
              />
              <div className="text-xs">
                <div className="font-mono font-semibold">{qrCodeValue}</div>
                <div className="text-slate-500">Naljepnicu možeš ispisati kasnije iz popisa aparata.</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="label">Proizvođač</label>
          <select
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
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    Ovaj proizvođač nema unesene tipove aparata. Odaberi drugog proizvođača ili se javi vendoru.
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>

        <div>
          <label className="label">Serijski broj</label>
          <input
            name="serialNumber"
            className="input"
            required={internalCode.trim().length === 0}
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            disabled={lookup.status === "found"}
          />
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

        <div>
          <label className="label">Godina proizvodnje</label>
          <input
            name="productionYear"
            type="number"
            className="input"
            required={internalCode.trim().length === 0}
            value={productionYear}
            onChange={(e) => setProductionYear(e.target.value)}
            disabled={lookup.status === "found"}
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

      <div className="flex gap-2 pt-2">
        <button
          className={[
            "btn px-4",
            canSubmit ? "btn-primary" : "bg-slate-300 text-slate-500 cursor-not-allowed",
          ].join(" ")}
          type="submit"
          disabled={!canSubmit}
        >
          Spremi
        </button>

        <Link className="btn btn-outline px-4" href={`/work-orders/${orderId}`}>
          Odustani
        </Link>
      </div>
    </form>
  );
}
