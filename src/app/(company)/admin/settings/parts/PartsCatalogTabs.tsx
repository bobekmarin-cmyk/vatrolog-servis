"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useDialog } from "@/components/ui/useDialog";

export type ManufacturerSettingRow = {
  id: string;
  name: string;
  platformPartsCount: number;
  usePlatformCatalog: boolean;
};

export type PlatformPartRow = {
  partId: string;
  manufacturerId: string;
  manufacturerCode: string;
  tenantCode: string;
  name: string;
  defaultPrice: number | null;
  tenantPrice: number | null;
  active: boolean;
  partActive: boolean;
};

export type CustomPartRow = {
  partId: string;
  manufacturerId: string;
  code: string;
  name: string;
  price: number | null;
  active: boolean;
  typeIds: string[];
};

export type ExtinguisherTypeOption = {
  id: string;
  /** Kratka oznaka unutar grupe izvedbe — npr. "ABC 6KG", "CO2 5KG". */
  label: string;
  /** Puna oznaka s izvedbom — npr. "Stalni tlak ABC 6KG". */
  fullLabel: string;
  /** Naziv izvedbe — npr. "Stalni tlak", "CO2". */
  constructionLabel: string;
  /** Sortni redoslijed izvedbe (manji = ranije). */
  constructionSort: number;
};

function fmtHrPrice(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("hr-HR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

export default function PartsCatalogTabs(props: {
  manufacturers: ManufacturerSettingRow[];
  platformParts: PlatformPartRow[];
  customParts: CustomPartRow[];
  typesByManufacturer: Record<string, ExtinguisherTypeOption[]>;
  initialManufacturerId: string | null;
  returnTo: string | null;
}) {
  const {
    manufacturers,
    platformParts,
    customParts,
    typesByManufacturer,
    initialManufacturerId,
    returnTo,
  } = props;

  const router = useRouter();
  const dialog = useDialog();

  const [selectedManuId, setSelectedManuId] = useState<string | null>(initialManufacturerId);
  const [busy, setBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustom, setEditCustom] = useState<CustomPartRow | null>(null);

  const selectedManu = useMemo(
    () => manufacturers.find((m) => m.id === selectedManuId) ?? null,
    [manufacturers, selectedManuId],
  );

  const platformOfSelected = useMemo(
    () => platformParts.filter((p) => p.manufacturerId === (selectedManuId ?? "")),
    [platformParts, selectedManuId],
  );
  const customOfSelected = useMemo(
    () => customParts.filter((p) => p.manufacturerId === (selectedManuId ?? "")),
    [customParts, selectedManuId],
  );
  const typesOfSelected = useMemo(
    () => (selectedManuId ? typesByManufacturer[selectedManuId] ?? [] : []),
    [typesByManufacturer, selectedManuId],
  );

  async function togglePlatformCatalog(manufacturerId: string, next: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings/parts/platform-catalog-toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manufacturerId, usePlatformCatalog: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      router.refresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće promijeniti postavku",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {returnTo ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          Nakon spremanja vratit ćemo vas na{" "}
          <a className="font-medium underline" href={returnTo}>
            {returnTo}
          </a>
          .
        </div>
      ) : null}

      <section className="flex flex-col gap-2 md:max-w-sm">
        <label
          htmlFor="parts-manufacturer-select"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Proizvođač
        </label>
        <select
          id="parts-manufacturer-select"
          className="h-10 w-full rounded-md border-2 border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-200"
          value={selectedManuId ?? ""}
          onChange={(e) => setSelectedManuId(e.target.value || null)}
        >
          <option value="">— Odaberite proizvođača —</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </section>

      {!selectedManu ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
          Odaberite proizvođača iznad za prikaz preddefiniranih i vlastitih dijelova.
        </div>
      ) : (
        <>
          <CatalogSection
            title={`Preddefinirani dijelovi — ${selectedManu.name}`}
            tone={
              selectedManu.platformPartsCount > 0 && !selectedManu.usePlatformCatalog
                ? "danger"
                : "normal"
            }
            actions={
              selectedManu.platformPartsCount === 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  Nema dijelova
                </span>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className={
                      "text-xs font-medium " +
                      (selectedManu.usePlatformCatalog ? "text-emerald-700" : "text-rose-800")
                    }
                  >
                    {selectedManu.usePlatformCatalog ? "Katalog uključen" : "Katalog isključen"}
                  </span>
                  <ToggleSwitch
                    checked={selectedManu.usePlatformCatalog}
                    disabled={busy}
                    onChange={(next) => togglePlatformCatalog(selectedManu.id, next)}
                    srLabel={
                      selectedManu.usePlatformCatalog
                        ? "Isključi preddefinirani katalog za ovog proizvođača"
                        : "Uključi preddefinirani katalog za ovog proizvođača"
                    }
                  />
                </div>
              )
            }
          >
            {selectedManu.platformPartsCount === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                Za ovog proizvođača još nema preddefiniranih rezervnih dijelova.
              </div>
            ) : (
              <PlatformPartsTable
                rows={platformOfSelected}
                disabled={!selectedManu.usePlatformCatalog}
                onSavedRefresh={() => router.refresh()}
              />
            )}
          </CatalogSection>

          <CatalogSection
            title={`Vlastiti dijelovi — ${selectedManu.name}`}
            actions={
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="btn btn-primary h-9 px-4 text-sm"
              >
                + Dodaj vlastiti dio
              </button>
            }
          >
            <CustomPartsTable
              rows={customOfSelected}
              types={typesOfSelected}
              onEdit={(r) => setEditCustom(r)}
              onSavedRefresh={() => router.refresh()}
            />
          </CatalogSection>
        </>
      )}

      {selectedManu ? (
        <CustomPartFormModal
          open={createOpen}
          mode="create"
          manufacturerId={selectedManu.id}
          manufacturerName={selectedManu.name}
          types={typesOfSelected}
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            if (returnTo) {
              window.location.href = returnTo;
              return;
            }
            router.refresh();
          }}
        />
      ) : null}

      {editCustom ? (
        <CustomPartFormModal
          open={!!editCustom}
          mode="edit"
          existing={editCustom}
          manufacturerId={editCustom.manufacturerId}
          manufacturerName={selectedManu?.name ?? ""}
          types={typesByManufacturer[editCustom.manufacturerId] ?? []}
          onClose={() => setEditCustom(null)}
          onSaved={() => {
            setEditCustom(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function CatalogSection({
  title,
  actions,
  tone = "normal",
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  tone?: "normal" | "danger";
  children: React.ReactNode;
}) {
  const isDanger = tone === "danger";
  return (
    <section className="space-y-3">
      <div
        className={
          "flex flex-wrap items-center justify-between gap-3 rounded-md px-3 py-2 transition-colors " +
          (isDanger
            ? "bg-rose-100 ring-1 ring-rose-200"
            : "bg-transparent")
        }
      >
        <h2
          className={
            "text-base font-semibold " + (isDanger ? "text-rose-900" : "text-slate-900")
          }
        >
          {title}
        </h2>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  srLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  srLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={srLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-400 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        (checked
          ? "bg-emerald-500 focus-visible:ring-emerald-400"
          : "bg-rose-500 focus-visible:ring-rose-400")
      }
    >
      <span
        className={
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
          (checked ? "translate-x-5" : "translate-x-0.5")
        }
      />
    </button>
  );
}

/* Zajednički, minimalistički stil za obje tablice. */
const MIN_TH = "px-3 py-2 align-middle";
const MIN_TD = "px-3 py-2.5 align-middle";

function SearchInput({
  value,
  onChange,
  placeholder = "Pretraži šifru ili naziv…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      className="h-9 w-full max-w-md rounded-md border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-200"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function StatusDot({
  kind,
  label,
}: {
  kind: "ok" | "off" | "muted";
  label: string;
}) {
  const dot =
    kind === "ok"
      ? "bg-emerald-500"
      : kind === "off"
        ? "bg-slate-300"
        : "bg-slate-400";
  const text =
    kind === "ok"
      ? "text-emerald-700"
      : kind === "off"
        ? "text-slate-500"
        : "text-slate-500";
  return (
    <span className={"inline-flex items-center gap-1.5 text-xs font-medium " + text}>
      <span className={"inline-block h-1.5 w-1.5 rounded-full " + dot} aria-hidden />
      {label}
    </span>
  );
}

function RowAction({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? "text-rose-700 hover:text-rose-900"
    : primary
      ? "text-slate-900 font-medium hover:text-black"
      : "text-slate-600 hover:text-slate-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "text-xs underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline " +
        color
      }
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function PlatformPartsTable({
  rows,
  disabled = false,
  onSavedRefresh,
}: {
  rows: PlatformPartRow[];
  disabled?: boolean;
  onSavedRefresh: () => void;
}) {
  const dialog = useDialog();
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<{
    partId: string;
    code: string;
    price: string;
  } | null>(null);
  const [busyPartId, setBusyPartId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // Kad se katalog isključi, prekini bilo koje aktivno uređivanje.
  useEffect(() => {
    if (disabled && editing) setEditing(null);
  }, [disabled, editing]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.manufacturerCode} ${r.tenantCode} ${r.name}`.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  // Reset strane kad se mijenja filter, broj redaka po strani ili izvor.
  useEffect(() => {
    setPage(1);
  }, [filter, pageSize, rows.length]);

  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliceStart = (safePage - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const pageRows = visible.slice(sliceStart, sliceEnd);
  const showRangeFrom = visible.length === 0 ? 0 : sliceStart + 1;
  const showRangeTo = Math.min(sliceEnd, visible.length);

  function startEdit(r: PlatformPartRow) {
    setEditing({
      partId: r.partId,
      code: r.tenantCode,
      price:
        r.tenantPrice != null
          ? new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
              r.tenantPrice,
            )
          : "",
    });
  }

  async function saveOverride() {
    if (!editing) return;
    setBusyPartId(editing.partId);
    try {
      const res = await fetch("/api/admin/settings/parts/platform-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: editing.partId,
          code: editing.code.trim() || null,
          price: parsePriceInput(editing.price),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      setEditing(null);
      onSavedRefresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće spremiti",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setBusyPartId(null);
    }
  }

  async function toggleActive(r: PlatformPartRow) {
    setBusyPartId(r.partId);
    try {
      const res = await fetch("/api/admin/settings/parts/platform-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partId: r.partId, active: !r.active }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      onSavedRefresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće promijeniti status",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setBusyPartId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div
      className={
        "space-y-2 " + (disabled ? "pointer-events-none select-none opacity-60" : "")
      }
      aria-disabled={disabled || undefined}
    >
      <SearchInput
        value={filter}
        onChange={setFilter}
        placeholder="Pretraži po šifri proizvođača, vašoj šifri ili nazivu…"
      />
      <div
        className={
          "overflow-x-auto rounded-lg border border-slate-200 " +
          (disabled ? "bg-slate-50" : "bg-white")
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th className={MIN_TH}>Šifra proizvođača</th>
              <th className={MIN_TH}>Vaša šifra</th>
              <th className={MIN_TH}>Naziv</th>
              <th className={MIN_TH + " text-right"}>Default cijena</th>
              <th className={MIN_TH + " text-right"}>Vaša cijena</th>
              <th className={MIN_TH}>Status</th>
              <th className={MIN_TH + " text-right"}>Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageRows.map((r) => {
              const busy = busyPartId === r.partId;
              const isEdit = editing?.partId === r.partId;
              const inactive = !r.active || !r.partActive;
              return (
                <tr
                  key={r.partId}
                  className={"hover:bg-slate-50/60 " + (inactive ? "opacity-60" : "")}
                >
                  <td className={MIN_TD + " font-mono text-xs text-slate-900"}>
                    {r.manufacturerCode || <span className="text-slate-400">—</span>}
                  </td>
                  <td className={MIN_TD + " font-mono text-xs"}>
                    {isEdit ? (
                      <input
                        className="h-8 w-32 rounded-md border border-slate-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
                        value={editing!.code}
                        onChange={(e) => setEditing({ ...editing!, code: e.target.value })}
                        maxLength={60}
                      />
                    ) : r.tenantCode ? (
                      r.tenantCode
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={MIN_TD + " text-slate-900"}>{r.name}</td>
                  <td className={MIN_TD + " text-right tabular-nums text-slate-500"}>
                    {fmtHrPrice(r.defaultPrice)}
                  </td>
                  <td className={MIN_TD + " text-right tabular-nums"}>
                    {isEdit ? (
                      <input
                        className="h-8 w-24 rounded-md border border-slate-300 px-2 text-right text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
                        value={editing!.price}
                        onChange={(e) => setEditing({ ...editing!, price: e.target.value })}
                        inputMode="decimal"
                      />
                    ) : (
                      fmtHrPrice(r.tenantPrice)
                    )}
                  </td>
                  <td className={MIN_TD}>
                    <StatusDot
                      kind={
                        disabled
                          ? "off"
                          : !r.partActive
                            ? "muted"
                            : r.active
                              ? "ok"
                              : "off"
                      }
                      label={
                        disabled
                          ? "Katalog isključen"
                          : !r.partActive
                            ? "Platform deaktiviran"
                            : r.active
                              ? "Aktivan"
                              : "Deaktiviran"
                      }
                    />
                  </td>
                  <td className={MIN_TD + " text-right"}>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      {isEdit ? (
                        <>
                          <RowAction onClick={() => setEditing(null)} disabled={busy}>
                            Odustani
                          </RowAction>
                          <RowAction onClick={saveOverride} disabled={busy} primary>
                            {busy ? "Spremam…" : "Spremi"}
                          </RowAction>
                        </>
                      ) : (
                        <>
                          <RowAction
                            onClick={() => toggleActive(r)}
                            disabled={busy || !r.partActive}
                          >
                            {r.active ? "Deaktiviraj" : "Aktiviraj"}
                          </RowAction>
                          <RowAction onClick={() => startEdit(r)} disabled={busy}>
                            Uredi
                          </RowAction>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-slate-500">
                  Nema dijelova koji odgovaraju pretrazi.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination
        page={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        rangeFrom={showRangeFrom}
        rangeTo={showRangeTo}
        total={visible.length}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  rangeFrom,
  rangeTo,
  total,
}: {
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (n: number) => void;
  onPageSizeChange: (n: number) => void;
  rangeFrom: number;
  rangeTo: number;
  total: number;
}) {
  if (total === 0) return null;
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="flex flex-col items-start justify-between gap-2 px-1 text-xs text-slate-600 sm:flex-row sm:items-center">
      <div>
        Prikazano <b className="tabular-nums">{rangeFrom}–{rangeTo}</b> od{" "}
        <b className="tabular-nums">{total}</b>
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-1">
          <span className="text-slate-500">Po stranici:</span>
          <select
            className="h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-200"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="ml-2 flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => onPageChange(page - 1)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Prethodna stranica"
          >
            ‹
          </button>
          <span className="px-1 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => onPageChange(page + 1)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Sljedeća stranica"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function CustomPartsTable({
  rows,
  types,
  onEdit,
  onSavedRefresh,
}: {
  rows: CustomPartRow[];
  types: ExtinguisherTypeOption[];
  onEdit: (r: CustomPartRow) => void;
  onSavedRefresh: () => void;
}) {
  const dialog = useDialog();
  const [filter, setFilter] = useState("");
  const [busyPartId, setBusyPartId] = useState<string | null>(null);

  const typeMap = useMemo(() => new Map(types.map((t) => [t.id, t.label])), [types]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.code} ${r.name}`.toLowerCase().includes(q));
  }, [rows, filter]);

  async function toggleActive(r: CustomPartRow) {
    setBusyPartId(r.partId);
    try {
      const res = await fetch(`/api/admin/settings/parts/custom/${r.partId}/active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !r.active }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      onSavedRefresh();
    } catch (e) {
      await dialog.alert({
        title: "Nije moguće promijeniti status",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setBusyPartId(null);
    }
  }

  async function deletePart(r: CustomPartRow) {
    const ok = await dialog.confirm({
      title: "Obrisati dio?",
      message: `Brišete vlastiti dio „${r.code} — ${r.name}". Ako je dio korišten u nalozima ili primkama, brisanje neće biti moguće, ali ga možete deaktivirati.`,
      confirmLabel: "Obriši",
      danger: true,
    });
    if (!ok) return;
    setBusyPartId(r.partId);
    try {
      const res = await fetch(`/api/warehouse/parts/${r.partId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      onSavedRefresh();
    } catch (e) {
      await dialog.alert({
        title: "Brisanje nije moguće",
        message: e instanceof Error ? e.message : "Greška.",
        variant: "error",
      });
    } finally {
      setBusyPartId(null);
    }
  }

  return (
    <div className="space-y-2">
      <SearchInput value={filter} onChange={setFilter} />
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] font-medium uppercase tracking-wide text-slate-500">
              <th className={MIN_TH}>Šifra</th>
              <th className={MIN_TH}>Naziv</th>
              <th className={MIN_TH}>Tipovi aparata</th>
              <th className={MIN_TH + " text-right"}>Cijena</th>
              <th className={MIN_TH}>Status</th>
              <th className={MIN_TH + " text-right"}>Akcije</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((r) => {
              const busy = busyPartId === r.partId;
              return (
                <tr
                  key={r.partId}
                  className={"hover:bg-slate-50/60 " + (!r.active ? "opacity-60" : "")}
                >
                  <td className={MIN_TD + " font-mono text-xs"}>{r.code}</td>
                  <td className={MIN_TD + " text-slate-900"}>{r.name}</td>
                  <td className={MIN_TD + " text-xs text-slate-600"}>
                    {r.typeIds.length === 0
                      ? "—"
                      : r.typeIds.length === types.length
                        ? "Svi aparati"
                        : r.typeIds.map((id) => typeMap.get(id) ?? id).join(", ")}
                  </td>
                  <td className={MIN_TD + " text-right tabular-nums text-slate-700"}>
                    {fmtHrPrice(r.price)}
                  </td>
                  <td className={MIN_TD}>
                    <StatusDot
                      kind={r.active ? "ok" : "off"}
                      label={r.active ? "Aktivan" : "Deaktiviran"}
                    />
                  </td>
                  <td className={MIN_TD + " text-right"}>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <RowAction onClick={() => toggleActive(r)} disabled={busy}>
                        {r.active ? "Deaktiviraj" : "Aktiviraj"}
                      </RowAction>
                      <RowAction onClick={() => onEdit(r)} disabled={busy}>
                        Uredi
                      </RowAction>
                      <RowAction onClick={() => deletePart(r)} disabled={busy} danger>
                        Obriši
                      </RowAction>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-slate-500">
                  {rows.length === 0
                    ? "Još nemate vlastitih dijelova za ovog proizvođača."
                    : "Nema dijelova koji odgovaraju pretrazi."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

function CustomPartFormModal(props: {
  open: boolean;
  mode: "create" | "edit";
  existing?: CustomPartRow;
  manufacturerId: string;
  manufacturerName: string;
  types: ExtinguisherTypeOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { open, mode, existing, manufacturerId, manufacturerName, types, onClose, onSaved } = props;
  const dialog = useDialog();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [active, setActive] = useState(true);
  const [scope, setScope] = useState<"all" | "specific">("all");
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setCode(existing.code);
      setName(existing.name);
      setPriceStr(
        existing.price != null
          ? new Intl.NumberFormat("hr-HR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
              existing.price,
            )
          : "",
      );
      setActive(existing.active);
      const allIds = types.map((t) => t.id).sort();
      const existingIds = [...existing.typeIds].sort();
      const isAllSelected =
        existingIds.length > 0 &&
        existingIds.length === allIds.length &&
        existingIds.every((id, i) => id === allIds[i]);
      setScope(isAllSelected || existingIds.length === 0 ? "all" : "specific");
      setTypeIds(isAllSelected ? [] : [...existing.typeIds]);
    } else {
      setCode("");
      setName("");
      setPriceStr("");
      setActive(true);
      setScope("all");
      setTypeIds([]);
    }
  }, [open, existing, types]);

  function toggleType(id: string) {
    setTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const groupedTypes = useMemo(() => {
    const map = new Map<string, { sort: number; items: ExtinguisherTypeOption[] }>();
    for (const t of types) {
      const cur = map.get(t.constructionLabel);
      if (cur) cur.items.push(t);
      else map.set(t.constructionLabel, { sort: t.constructionSort, items: [t] });
    }
    return Array.from(map.entries())
      .map(([label, v]) => ({ label, sort: v.sort, items: v.items }))
      .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "hr"));
  }, [types]);

  async function submit() {
    if (!code.trim()) {
      await dialog.alert({ title: "Šifra je obavezna", message: "Unesite šifru.", variant: "warning" });
      return;
    }
    if (!name.trim()) {
      await dialog.alert({ title: "Naziv je obavezan", message: "Unesite naziv.", variant: "warning" });
      return;
    }
    const finalTypeIds = scope === "all" ? types.map((t) => t.id) : typeIds;
    if (finalTypeIds.length === 0) {
      await dialog.alert({
        title: "Tipovi aparata",
        message:
          types.length === 0
            ? "Ovaj proizvođač još nema povezanih tipova aparata."
            : "Odaberite barem jedan tip aparata.",
        variant: "warning",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/parts/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partId: existing?.partId ?? null,
          manufacturerId,
          code: code.trim(),
          name: name.trim(),
          price: parsePriceInput(priceStr),
          active,
          typeIds: finalTypeIds,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error || "Greška.");
      onSaved();
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

  return (
    <Modal
      open={open}
      title={mode === "create" ? "Novi vlastiti dio" : "Uredi vlastiti dio"}
      variant="neutral"
      size="lg"
      onClose={() => !saving && onClose()}
      closeOnBackdrop={!saving}
      closeOnEsc={!saving}
      footer={
        <>
          <button
            type="button"
            disabled={saving}
            onClick={() => onClose()}
            className="btn btn-outline px-4"
          >
            Odustani
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="btn btn-primary px-4"
          >
            {saving ? "Spremam…" : "Spremi"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
          Vlastiti dio je vidljiv samo vašoj tvrtki. Proizvođač:{" "}
          <b>{manufacturerName}</b>.
        </p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="cp-code">
              Šifra <span className="text-red-600">*</span>
            </label>
            <input
              id="cp-code"
              className="input font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={60}
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="cp-name">
              Naziv <span className="text-red-600">*</span>
            </label>
            <input
              id="cp-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              disabled={saving}
            />
          </div>
          <div>
            <label className="label" htmlFor="cp-price">
              Cijena (EUR)
            </label>
            <input
              id="cp-price"
              className="input text-right tabular-nums"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              inputMode="decimal"
              placeholder="npr. 12,50"
              disabled={saving}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={saving}
              />
              Dio je aktivan (nudi se na servisu i u skladištu)
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-slate-700">
            Vrijedi za tipove aparata <span className="text-red-600">*</span>
          </div>

          {types.length === 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              Ovaj proizvođač još nema povezanih tipova aparata u platform katalogu.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5 sm:flex-row sm:gap-6">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="cp-scope"
                    className="h-4 w-4 border-slate-300 text-red-600 focus:ring-red-200"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                    disabled={saving}
                  />
                  Vrijedi za sve aparate
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input
                    type="radio"
                    name="cp-scope"
                    className="h-4 w-4 border-slate-300 text-red-600 focus:ring-red-200"
                    checked={scope === "specific"}
                    onChange={() => setScope("specific")}
                    disabled={saving}
                  />
                  Vrijedi za pojedine aparate
                </label>
              </div>

              {scope === "specific" ? (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  {groupedTypes.map((g) => (
                    <div key={g.label}>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {g.label}
                      </div>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                        {g.items.map((t) => (
                          <label
                            key={t.id}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-white px-2 py-1 text-sm hover:bg-slate-100"
                          >
                            <input
                              type="checkbox"
                              checked={typeIds.includes(t.id)}
                              onChange={() => toggleType(t.id)}
                              className="h-4 w-4 rounded border-slate-300"
                              disabled={saving}
                            />
                            {t.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
