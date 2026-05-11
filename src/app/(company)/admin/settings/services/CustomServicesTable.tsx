"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useDialog } from "@/components/ui/useDialog";
import {
  MIN_TABLE_TD,
  MIN_TABLE_TH,
  MinimalRowAction,
  MinimalSearchInput,
  MinimalTableShell,
} from "@/components/admin/minimalSettingsTable";

export type CustomServiceRow = {
  id: string;
  name: string;
  code: string;
  price: number | null;
  isActive: boolean;
};

function formatHrPrice(p: number | null | undefined): string {
  if (p == null || Number.isNaN(p)) return "—";
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(p);
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export default function CustomServicesTable({ initialRows }: { initialRows: CustomServiceRow[] }) {
  const router = useRouter();
  const dialog = useDialog();
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editRow, setEditRow] = useState<CustomServiceRow | null>(null);

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editRow) {
      setName(editRow.name);
      setCode(editRow.code ?? "");
      setPriceStr(
        editRow.price != null
          ? new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
              editRow.price,
            )
          : "",
      );
      setIsActive(editRow.isActive);
    }
  }, [editRow]);

  useEffect(() => {
    if (createOpen) {
      setName("");
      setCode("");
      setPriceStr("");
      setIsActive(true);
    }
  }, [createOpen]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered =
      !q
        ? initialRows
        : initialRows.filter((r) =>
            `${r.name} ${r.code} ${r.price ?? ""}`.toLowerCase().includes(q),
          );
    return [...filtered].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      const ca = (a.code ?? "").trim();
      const cb = (b.code ?? "").trim();
      const emptyA = ca.length === 0 ? 1 : 0;
      const emptyB = cb.length === 0 ? 1 : 0;
      if (emptyA !== emptyB) return emptyA - emptyB;
      const cmpCode = ca.localeCompare(cb, "hr", { numeric: true, sensitivity: "base" });
      if (cmpCode !== 0) return cmpCode;
      return a.name.localeCompare(b.name, "hr", { sensitivity: "base" });
    });
  }, [initialRows, filter]);

  async function saveCreate() {
    const n = name.trim();
    if (!n) {
      await dialog.alert({
        title: "Naziv je obavezan",
        message: "Unesite naziv usluge.",
        variant: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/custom-services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: n,
          code: code.trim() || null,
          price: parsePriceInput(priceStr),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Greška pri spremanju.");
      setCreateOpen(false);
      router.refresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće spremiti",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editRow) return;
    const n = name.trim();
    if (!n) {
      await dialog.alert({
        title: "Naziv je obavezan",
        message: "Unesite naziv usluge.",
        variant: "warning",
      });
      return;
    }
    const newCode = code.trim();
    const newPrice = parsePriceInput(priceStr);
    const body: Record<string, unknown> = {};
    if (n !== editRow.name) body.name = n;
    if (newCode !== (editRow.code ?? "")) body.code = newCode.length ? newCode : null;
    if (newPrice !== (editRow.price ?? null)) body.price = newPrice;
    if (isActive !== editRow.isActive) body.isActive = isActive;
    if (Object.keys(body).length === 0) {
      setEditRow(null);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/custom-services/${editRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Greška pri spremanju.");
      setEditRow(null);
      router.refresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće spremiti",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function quickToggleActive(r: CustomServiceRow) {
    try {
      const res = await fetch(`/api/admin/custom-services/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Greška.");
      router.refresh();
    } catch (e) {
      await dialog.alert({
        title: "Greška",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    }
  }

  const modalBusy = saving;

  const addBtn: ReactNode = (
    <button
      type="button"
      className="btn btn-primary h-9 shrink-0 px-4 text-sm"
      onClick={() => setCreateOpen(true)}
    >
      + Dodaj uslugu
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        <MinimalSearchInput
          value={filter}
          onChange={setFilter}
          placeholder="Pretraži po šifri ili nazivu…"
          endSlot={
            <>
              <span className="subtle shrink-0 tabular-nums">Ukupno: {initialRows.length}</span>
              {addBtn}
            </>
          }
        />
      </div>

      <MinimalTableShell className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] border-b border-slate-200 bg-white text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className={MIN_TABLE_TH + " w-[140px]"}>Šifra</th>
              <th className={MIN_TABLE_TH}>Usluga</th>
              <th className={MIN_TABLE_TH + " w-[120px] text-right"}>Cijena</th>
              <th className={MIN_TABLE_TH + " w-[200px] text-right"}>Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => (
              <tr
                key={r.id}
                className={"hover:bg-slate-50/60 " + (!r.isActive ? "opacity-60" : "")}
              >
                <td className={MIN_TABLE_TD + " font-mono text-xs text-slate-900"}>
                  {(r.code ?? "").length > 0 ? r.code : <span className="text-slate-400">—</span>}
                </td>
                <td className={MIN_TABLE_TD + " font-medium text-slate-900"}>{r.name}</td>
                <td className={MIN_TABLE_TD + " text-right tabular-nums text-slate-700"}>
                  {formatHrPrice(r.price)}
                </td>
                <td className={MIN_TABLE_TD}>
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    <MinimalRowAction onClick={() => quickToggleActive(r)}>
                      {r.isActive ? "Deaktiviraj" : "Aktiviraj"}
                    </MinimalRowAction>
                    <MinimalRowAction onClick={() => setEditRow(r)}>Uredi</MinimalRowAction>
                  </div>
                </td>
              </tr>
            ))}
            {visible.length === 0 && initialRows.length > 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={4}>
                  Nema redaka koji odgovaraju pretrazi.
                </td>
              </tr>
            )}
            {initialRows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-sm text-slate-500" colSpan={4}>
                  Još nemate vlastitih usluga. Dodajte ih gumbom „+ Dodaj uslugu“.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </MinimalTableShell>

      <p className="text-xs text-slate-500">
        Savjet: <b>Uredi</b> otvara prozor za naziv, šifru, cijenu i status. Deaktivirana usluga se više
        ne nudi u izbornicima, ali ostaje na već povezanim stavkama radnog naloga.
      </p>

      <Modal
        open={createOpen}
        title="Nova vlastita usluga"
        variant="neutral"
        size="md"
        onClose={() => !modalBusy && setCreateOpen(false)}
        closeOnBackdrop={!modalBusy}
        closeOnEsc={!modalBusy}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline px-4"
              disabled={modalBusy}
              onClick={() => setCreateOpen(false)}
            >
              Odustani
            </button>
            <button type="button" className="btn btn-primary px-4" disabled={modalBusy} onClick={saveCreate}>
              {modalBusy ? "Spremam…" : "Spremi"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="custom-new-name">
              Naziv usluge <span className="text-red-600">*</span>
            </label>
            <input
              id="custom-new-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="npr. Punjenje dušikom"
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="custom-new-code">
              Šifra
            </label>
            <input
              id="custom-new-code"
              className="input font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={50}
              placeholder="—"
            />
          </div>
          <div>
            <label className="label" htmlFor="custom-new-price">
              Cijena
            </label>
            <input
              id="custom-new-price"
              className="input text-right tabular-nums"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              placeholder="npr. 25,00"
              inputMode="decimal"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editRow}
        title="Uredi vlastitu uslugu"
        variant="neutral"
        size="md"
        onClose={() => !modalBusy && setEditRow(null)}
        closeOnBackdrop={!modalBusy}
        closeOnEsc={!modalBusy}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline px-4"
              disabled={modalBusy}
              onClick={() => setEditRow(null)}
            >
              Odustani
            </button>
            <button type="button" className="btn btn-primary px-4" disabled={modalBusy} onClick={saveEdit}>
              {modalBusy ? "Spremam…" : "Spremi"}
            </button>
          </>
        }
      >
        {editRow ? (
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="custom-edit-name">
                Naziv usluge <span className="text-red-600">*</span>
              </label>
              <input
                id="custom-edit-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <label className="label" htmlFor="custom-edit-code">
                Šifra
              </label>
              <input
                id="custom-edit-code"
                className="input font-mono"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={50}
                placeholder="—"
              />
            </div>
            <div>
              <label className="label" htmlFor="custom-edit-price">
                Cijena
              </label>
              <input
                id="custom-edit-price"
                className="input text-right tabular-nums"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Usluga je aktivna (vidljiva u izbornicima)
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
