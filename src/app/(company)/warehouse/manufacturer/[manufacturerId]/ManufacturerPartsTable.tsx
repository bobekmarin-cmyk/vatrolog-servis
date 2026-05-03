"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

type Row = {
  partId: string;
  code: string;
  name: string;
  stockQty: number;
  minStockQty: number;
  hasStockRow: boolean;
  hidden: boolean;
  isCustom: boolean;
};

type TypeOption = { id: string; label: string };

function statusFor(r: Row): { label: string; className: string } {
  if (r.hidden) return { label: "Neaktivan", className: "bg-slate-200 text-slate-600" };
  if (r.stockQty < 0) return { label: "U minusu", className: "bg-rose-100 text-rose-900" };
  if (r.minStockQty > 0 && r.stockQty <= r.minStockQty) {
    return { label: "Ispod min.", className: "bg-amber-100 text-amber-900" };
  }
  if (r.stockQty === 0) return { label: "Prazno", className: "bg-slate-100 text-slate-600" };
  return { label: "OK", className: "bg-emerald-100 text-emerald-900" };
}

export default function ManufacturerPartsTable({
  manufacturerId,
  rows,
  extinguisherTypes,
}: {
  manufacturerId: string;
  rows: Row[];
  extinguisherTypes: TypeOption[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [busyPartId, setBusyPartId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter((r) => {
      if (!showHidden && r.hidden) return false;
      if (!f) return true;
      return r.code.toLowerCase().includes(f) || r.name.toLowerCase().includes(f);
    });
  }, [rows, filter, showHidden]);

  const hiddenCount = rows.filter((r) => r.hidden).length;

  async function toggleHidden(partId: string, nextHidden: boolean) {
    setBusyPartId(partId);
    setActionError(null);
    try {
      const res = await fetch("/api/warehouse/parts/visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId, hidden: nextHidden }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Promjena nije uspjela.");
      }
      router.refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setBusyPartId(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Pretraži šifru ili naziv…"
          className="input h-9 w-full max-w-md flex-1"
        />
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Prikaži neaktivne{hiddenCount > 0 ? ` (${hiddenCount})` : ""}
        </label>
        <button type="button" onClick={() => setAddOpen(true)} className="btn btn-primary h-9">
          + Dodaj vlastiti dio
        </button>
      </div>

      {actionError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left">
              <tr>
                <th className="px-3 py-2">Šifra</th>
                <th className="px-3 py-2">Naziv</th>
                <th className="px-3 py-2 text-right">Stanje</th>
                <th className="px-3 py-2 text-right">Min.</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => {
                const st = statusFor(r);
                const busy = busyPartId === r.partId;
                return (
                  <tr
                    key={r.partId}
                    className={`hover:bg-slate-50 ${r.hidden ? "opacity-60" : ""}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span>{r.code}</span>
                        {r.isCustom && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                            Vlastiti
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={`/warehouse/parts/${r.partId}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        r.stockQty < 0 ? "font-bold text-rose-700" : ""
                      }`}
                    >
                      {r.stockQty}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                      {r.minStockQty}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.className}`}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => toggleHidden(r.partId, !r.hidden)}
                          disabled={busy}
                          className={`rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-40 ${
                            r.hidden
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                          title={r.hidden ? "Aktiviraj dio" : "Deaktiviraj dio za vašu tvrtku"}
                        >
                          {r.hidden ? "Aktiviraj" : "Deaktiviraj"}
                        </button>
                        <Link
                          href={`/warehouse/parts/${r.partId}`}
                          className="text-xs font-medium text-slate-700 hover:underline"
                        >
                          Kartica →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Nema dijelova za prikaz.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <AddCustomPartModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        manufacturerId={manufacturerId}
        extinguisherTypes={extinguisherTypes}
        onCreated={() => {
          setAddOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function AddCustomPartModal({
  open,
  onClose,
  manufacturerId,
  extinguisherTypes,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  manufacturerId: string;
  extinguisherTypes: TypeOption[];
  onCreated: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [common, setCommon] = useState(false);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleType(id: string) {
    setTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function reset() {
    setCode("");
    setName("");
    setCommon(false);
    setTypeIds([]);
    setError(null);
  }

  async function submit() {
    setError(null);
    if (!code.trim()) return setError("Šifra je obavezna.");
    if (!name.trim()) return setError("Naziv je obavezan.");
    if (typeIds.length === 0) return setError("Odaberite barem jedan tip aparata.");
    setSaving(true);
    try {
      const res = await fetch("/api/warehouse/parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manufacturerId,
          code: code.trim(),
          name: name.trim(),
          common,
          typeIds,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Spremanje nije uspjelo.");
      reset();
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Dodaj vlastiti dio"
      variant="neutral"
      size="lg"
      onClose={() => {
        if (saving) return;
        reset();
        onClose();
      }}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (saving) return;
              reset();
              onClose();
            }}
            disabled={saving}
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Odustani
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Spremam…" : "Spremi dio"}
          </button>
        </>
      }
    >
      <div className="space-y-3 p-5">
        <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
          Ovaj dio će biti vidljiv samo vašoj tvrtki. Vendor platforme ga ne vidi.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Šifra *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input h-10 w-full"
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Naziv *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input h-10 w-full"
              disabled={saving}
            />
          </div>
        </div>
        <div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={common}
              onChange={(e) => setCommon(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
              disabled={saving}
            />
            Čest dio (pojavljuje se među uobičajenim na servisu)
          </label>
        </div>
        <div>
          <div className="mb-1 text-sm font-medium text-slate-700">Vrijedi za tipove aparata *</div>
          {extinguisherTypes.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Ovaj proizvođač još nema povezanih tipova aparata u platform katalogu.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
              {extinguisherTypes.map((t) => (
                <label
                  key={t.id}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={typeIds.includes(t.id)}
                    onChange={() => toggleType(t.id)}
                    disabled={saving}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {t.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {error && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
