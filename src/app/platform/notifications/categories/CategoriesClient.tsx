"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  isUpdate: boolean;
  active: boolean;
  sortOrder: number;
  notificationsCount: number;
};

type DraftCategory = {
  name: string;
  slug: string;
  description: string;
  color: string;
  isUpdate: boolean;
  sortOrder: number;
};

const EMPTY_DRAFT: DraftCategory = {
  name: "",
  slug: "",
  description: "",
  color: "#475569",
  isUpdate: false,
  sortOrder: 0,
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export default function CategoriesClient({
  initialCategories,
}: {
  initialCategories: CategoryRow[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftCategory>(EMPTY_DRAFT);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createCategory() {
    setError(null);
    if (!draft.name.trim()) {
      setError("Naziv kategorije je obavezan.");
      return;
    }
    const slug = (draft.slug.trim() || slugify(draft.name)).slice(0, 64);
    if (!slug) {
      setError("Slug nije moguće generirati — promijenite naziv.");
      return;
    }
    setSaving("create");
    try {
      const res = await fetch("/api/platform/notifications/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, slug }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Spremanje nije uspjelo.");
      }
      setDraft(EMPTY_DRAFT);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod spremanja.");
    } finally {
      setSaving(null);
    }
  }

  async function updateCategory(c: CategoryRow, patch: Partial<CategoryRow>) {
    setSaving(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/platform/notifications/categories/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Promjena nije spremljena.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod spremanja.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteCategory(c: CategoryRow) {
    if (c.notificationsCount > 0) {
      setError("Kategorija ima vezane obavijesti — najprije ih premjestite ili obrišite.");
      return;
    }
    if (!confirm(`Obrisati kategoriju "${c.name}"?`)) return;
    setSaving(c.id);
    try {
      const res = await fetch(`/api/platform/notifications/categories/${c.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Brisanje nije uspjelo.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod brisanja.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="surface">
        <div className="surface-header">
          <h2 className="h1">Postojeće kategorije</h2>
          <span className="subtle">Ukupno: {initialCategories.length}</span>
        </div>
        <div className="h-px bg-black/10" />

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-600">
                <th className="p-3 w-44">Naziv</th>
                <th className="p-3 w-44">Slug</th>
                <th className="p-3">Opis</th>
                <th className="p-3 w-24">Boja</th>
                <th className="p-3 w-20 text-center">Update</th>
                <th className="p-3 w-20 text-center">Aktivna</th>
                <th className="p-3 w-24 text-center">Poruke</th>
                <th className="p-3 w-32 text-right">Akcija</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {initialCategories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-3 align-top font-medium">{c.name}</td>
                  <td className="p-3 align-top font-mono text-xs text-slate-600">{c.slug}</td>
                  <td className="p-3 align-top text-xs text-slate-600">{c.description ?? "—"}</td>
                  <td className="p-3 align-top">
                    <span
                      className="inline-block h-4 w-8 rounded border border-slate-200"
                      style={{ backgroundColor: c.color ?? "#475569" }}
                      title={c.color ?? ""}
                    />
                  </td>
                  <td className="p-3 align-top text-center">{c.isUpdate ? "DA" : "—"}</td>
                  <td className="p-3 align-top text-center">
                    <button
                      type="button"
                      className={[
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        c.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                      onClick={() => updateCategory(c, { active: !c.active })}
                      disabled={saving === c.id}
                    >
                      {c.active ? "Aktivna" : "Neaktivna"}
                    </button>
                  </td>
                  <td className="p-3 align-top text-center text-slate-700">
                    {c.notificationsCount}
                  </td>
                  <td className="p-3 align-top text-right">
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:underline disabled:opacity-50"
                      onClick={() => deleteCategory(c)}
                      disabled={saving === c.id || c.notificationsCount > 0}
                      title={
                        c.notificationsCount > 0
                          ? "Kategorija ima poruke — najprije ih obrišite ili premjestite."
                          : ""
                      }
                    >
                      Obriši
                    </button>
                  </td>
                </tr>
              ))}
              {initialCategories.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">
                    Nema kategorija.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface p-4">
        <h2 className="h1">Nova kategorija</h2>
        <p className="subtle">
          Slug se generira iz naziva ako ga ne upišete; mora biti jedinstven (npr.{" "}
          <code>akcije</code>).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Naziv *</span>
            <input
              className="input mt-1 w-full"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="npr. Akcije i popusti"
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Slug</span>
            <input
              className="input mt-1 w-full font-mono"
              value={draft.slug}
              onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
              placeholder={slugify(draft.name) || "auto iz naziva"}
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs font-medium text-slate-700">Opis</span>
            <textarea
              className="input mt-1 w-full"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Kratki interni opis kategorije."
            />
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Boja oznake</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-12 rounded border border-slate-200"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              />
              <input
                className="input flex-1 font-mono"
                value={draft.color}
                onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
              />
            </div>
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={draft.isUpdate}
              onChange={(e) => setDraft((d) => ({ ...d, isUpdate: e.target.checked }))}
            />
            <span>Kategorija predstavlja <b>Ažuriranja</b> (proširen prikaz)</span>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Sort order</span>
            <input
              type="number"
              className="input mt-1 w-full"
              value={draft.sortOrder}
              onChange={(e) =>
                setDraft((d) => ({ ...d, sortOrder: Number(e.target.value) || 0 }))
              }
            />
          </label>
        </div>

        <div className="mt-4">
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={createCategory}
            disabled={saving === "create"}
          >
            {saving === "create" ? "Spremam…" : "+ Dodaj kategoriju"}
          </button>
        </div>
      </section>
    </div>
  );
}
