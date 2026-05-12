"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UPDATE_SECTION_KINDS,
  UPDATE_SECTION_LABELS,
  type UpdatePayload,
  type UpdateSection,
  type UpdateSectionKind,
} from "@/lib/notifications";

type CategoryOption = { id: string; name: string; isUpdate: boolean };

type ComposerStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

type State = {
  categoryId: string;
  title: string;
  summary: string;
  body: string;
  status: ComposerStatus;
  pinned: boolean;
  update: UpdatePayload | null;
};

type Props =
  | {
      mode: "create";
      categories: CategoryOption[];
      defaultVersion?: string;
    }
  | {
      mode: "edit";
      notificationId: string;
      categories: CategoryOption[];
      initialState: State;
    };

const EMPTY_UPDATE = (defaultVersion: string): UpdatePayload => ({
  version: defaultVersion,
  releaseDate: new Date().toISOString().slice(0, 10),
  sections: [{ kind: "NEW", title: "", items: [""] }],
});

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function NotificationComposer(props: Props) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const defaultVersion = props.mode === "create" ? props.defaultVersion ?? "" : "";

  const [state, setState] = useState<State>(() => {
    if (props.mode === "edit") return props.initialState;
    return {
      categoryId: props.categories[0]?.id ?? "",
      title: "",
      summary: "",
      body: "",
      status: "DRAFT",
      pinned: false,
      update: null,
    };
  });

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedCategory = useMemo(
    () => props.categories.find((c) => c.id === state.categoryId) ?? null,
    [props.categories, state.categoryId],
  );

  function setUpdate(next: UpdatePayload | null) {
    setState((s) => ({ ...s, update: next }));
  }

  function ensureUpdate(): UpdatePayload {
    if (state.update) return state.update;
    const fresh = EMPTY_UPDATE(defaultVersion || "1.0.0");
    setUpdate(fresh);
    return fresh;
  }

  function patchSection(idx: number, patch: Partial<UpdateSection>) {
    const cur = ensureUpdate();
    const next: UpdatePayload = {
      ...cur,
      sections: cur.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    };
    setUpdate(next);
  }

  function addSection(kind: UpdateSectionKind) {
    const cur = ensureUpdate();
    setUpdate({
      ...cur,
      sections: [...cur.sections, { kind, title: "", items: [""] }],
    });
  }

  function removeSection(idx: number) {
    const cur = ensureUpdate();
    setUpdate({ ...cur, sections: cur.sections.filter((_, i) => i !== idx) });
  }

  function patchItem(sIdx: number, iIdx: number, value: string) {
    const cur = ensureUpdate();
    const next: UpdatePayload = {
      ...cur,
      sections: cur.sections.map((s, i) =>
        i === sIdx
          ? { ...s, items: s.items.map((it, j) => (j === iIdx ? value : it)) }
          : s,
      ),
    };
    setUpdate(next);
  }

  function addItem(sIdx: number) {
    const cur = ensureUpdate();
    const next: UpdatePayload = {
      ...cur,
      sections: cur.sections.map((s, i) =>
        i === sIdx ? { ...s, items: [...s.items, ""] } : s,
      ),
    };
    setUpdate(next);
  }

  function removeItem(sIdx: number, iIdx: number) {
    const cur = ensureUpdate();
    const next: UpdatePayload = {
      ...cur,
      sections: cur.sections.map((s, i) =>
        i === sIdx ? { ...s, items: s.items.filter((_, j) => j !== iIdx) } : s,
      ),
    };
    setUpdate(next);
  }

  async function save(action: "draft" | "publish" | "archive") {
    setError(null);
    if (!state.categoryId) {
      setError("Odaberite kategoriju.");
      return;
    }
    if (!state.title.trim()) {
      setError("Naslov je obavezan.");
      return;
    }

    const isUpdate = !!selectedCategory?.isUpdate;
    const payload = {
      categoryId: state.categoryId,
      title: state.title.trim(),
      summary: state.summary.trim() || null,
      body: state.body,
      pinned: state.pinned,
      status:
        action === "draft"
          ? "DRAFT"
          : action === "publish"
            ? "PUBLISHED"
            : "ARCHIVED",
      updatePayload: isUpdate
        ? state.update
          ? {
              version: state.update.version.trim(),
              releaseDate: state.update.releaseDate || toIsoDate(new Date()),
              sections: state.update.sections
                .map((s) => ({
                  kind: s.kind,
                  title: s.title?.trim() ? s.title.trim() : undefined,
                  items: s.items.map((it) => it.trim()).filter((it) => it.length > 0),
                }))
                .filter((s) => s.items.length > 0),
            }
          : null
        : null,
    };

    if (isUpdate) {
      if (!payload.updatePayload || !payload.updatePayload.version) {
        setError("Za kategoriju Ažuriranja je verzija obavezna.");
        return;
      }
      if (payload.updatePayload.sections.length === 0) {
        setError("Dodajte barem jednu sekciju s barem jednom stavkom.");
        return;
      }
    }

    setBusy(action);
    try {
      const url = isEdit
        ? `/api/platform/notifications/${(props as { notificationId: string }).notificationId}`
        : "/api/platform/notifications";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Spremanje nije uspjelo.");
      }
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      const goto =
        action === "publish"
          ? "/platform/notifications"
          : isEdit
            ? `/platform/notifications/${(props as { notificationId: string }).notificationId}`
            : json?.id
              ? `/platform/notifications/${json.id}`
              : "/platform/notifications";
      router.push(goto);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod spremanja.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteNotification() {
    if (!isEdit) return;
    if (!confirm("Trajno obrisati ovu obavijest? Ova akcija je nepovratna.")) return;
    setBusy("delete");
    try {
      const res = await fetch(
        `/api/platform/notifications/${(props as { notificationId: string }).notificationId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Brisanje nije uspjelo.");
      }
      router.push("/platform/notifications");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Greška kod brisanja.");
    } finally {
      setBusy(null);
    }
  }

  const isUpdate = !!selectedCategory?.isUpdate;
  const update = state.update;

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      <section className="surface p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Kategorija *</span>
            <select
              className="input mt-1 w-full"
              value={state.categoryId}
              onChange={(e) => setState((s) => ({ ...s, categoryId: e.target.value }))}
            >
              <option value="">— odaberi —</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isUpdate ? " (Ažuriranja)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs font-medium text-slate-700">Naslov *</span>
            <input
              className="input mt-1 w-full"
              value={state.title}
              onChange={(e) => setState((s) => ({ ...s, title: e.target.value }))}
              placeholder="npr. Planirano održavanje 18.05.2026."
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs font-medium text-slate-700">Sažetak (1-2 rečenice)</span>
            <input
              className="input mt-1 w-full"
              value={state.summary}
              onChange={(e) => setState((s) => ({ ...s, summary: e.target.value }))}
              placeholder="Kratki sažetak koji se vidi u listi."
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="block text-xs font-medium text-slate-700">Tekst poruke</span>
            <textarea
              className="input mt-1 w-full font-mono text-xs"
              rows={isUpdate ? 4 : 10}
              value={state.body}
              onChange={(e) => setState((s) => ({ ...s, body: e.target.value }))}
              placeholder={
                isUpdate
                  ? "Opcionalni uvodni tekst (npr. zahvala, kontekst objave)."
                  : "Glavni tekst obavijesti…"
              }
            />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={state.pinned}
              onChange={(e) => setState((s) => ({ ...s, pinned: e.target.checked }))}
            />
            <span>Pin na vrh liste kod admina</span>
          </label>
        </div>
      </section>

      {isUpdate ? (
        <section className="surface p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="h1">Detaljne izmjene</h2>
              <p className="subtle">
                Strukturirani sadržaj se prikazuje u proširenom layoutu: <b>Novo</b>,{" "}
                <b>Poboljšano</b>, <b>Ispravljeno</b>, <b>Važno</b>. Što je više detalja, to
                korisnici bolje znaju što se promijenilo.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-xs font-medium text-slate-700">Verzija *</span>
              <input
                className="input mt-1 w-full font-mono"
                value={update?.version ?? ""}
                onChange={(e) =>
                  setUpdate({
                    ...(update ?? EMPTY_UPDATE(defaultVersion || "1.0.0")),
                    version: e.target.value,
                  })
                }
                placeholder="1.1.0"
              />
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium text-slate-700">Datum objave</span>
              <input
                type="date"
                className="input mt-1 w-full"
                value={update?.releaseDate ?? ""}
                onChange={(e) =>
                  setUpdate({
                    ...(update ?? EMPTY_UPDATE(defaultVersion || "1.0.0")),
                    releaseDate: e.target.value,
                  })
                }
              />
            </label>
          </div>

          <div className="space-y-3">
            {(update?.sections ?? []).map((s, sIdx) => (
              <div
                key={sIdx}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <select
                      className="input h-8 w-44 text-sm"
                      value={s.kind}
                      onChange={(e) =>
                        patchSection(sIdx, { kind: e.target.value as UpdateSectionKind })
                      }
                    >
                      {UPDATE_SECTION_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {UPDATE_SECTION_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input h-8 w-72 text-sm"
                      placeholder={`Naslov sekcije (default: ${UPDATE_SECTION_LABELS[s.kind]})`}
                      value={s.title ?? ""}
                      onChange={(e) => patchSection(sIdx, { title: e.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:underline"
                    onClick={() => removeSection(sIdx)}
                  >
                    × Ukloni sekciju
                  </button>
                </div>

                <div className="space-y-1.5">
                  {s.items.map((it, iIdx) => (
                    <div key={iIdx} className="flex items-start gap-2">
                      <span className="mt-2 text-slate-400">•</span>
                      <textarea
                        className="input flex-1 text-sm"
                        rows={2}
                        value={it}
                        onChange={(e) => patchItem(sIdx, iIdx, e.target.value)}
                        placeholder="npr. Dodali smo novu stranicu Obavijesti za admine — sidebar pokazuje crveni broj nepročitanih."
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs text-slate-500 hover:text-rose-600"
                        onClick={() => removeItem(sIdx, iIdx)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => addItem(sIdx)}
                  >
                    + Dodaj stavku
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {UPDATE_SECTION_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                className="btn btn-outline h-8 px-3 text-xs"
                onClick={() => addSection(k)}
              >
                + {UPDATE_SECTION_LABELS[k]}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline px-4"
            onClick={() => save("draft")}
            disabled={!!busy}
          >
            {busy === "draft" ? "Spremam…" : "Spremi skicu"}
          </button>
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={() => save("publish")}
            disabled={!!busy}
          >
            {busy === "publish" ? "Objavljujem…" : "Objavi"}
          </button>
          {isEdit && state.status !== "ARCHIVED" ? (
            <button
              type="button"
              className="btn btn-outline px-4"
              onClick={() => save("archive")}
              disabled={!!busy}
            >
              {busy === "archive" ? "Arhiviram…" : "Arhiviraj"}
            </button>
          ) : null}
        </div>
        {isEdit ? (
          <button
            type="button"
            className="text-sm text-rose-600 hover:underline"
            onClick={deleteNotification}
            disabled={!!busy}
          >
            Obriši obavijest
          </button>
        ) : null}
      </div>
    </div>
  );
}
