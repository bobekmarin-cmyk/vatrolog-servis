"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FieldKey = "subject" | "greeting" | "bodyText" | "calloutText" | "closingText" | "footerNote";

type TemplateFields = {
  subject: string;
  greeting: string;
  bodyText: string;
  calloutText: string;
  closingText: string;
  footerNote: string | null;
};

type TemplateVariable = {
  name: string;
  description: string;
  example: string;
};

type Props = {
  type: string;
  initialFields: TemplateFields;
  defaults: TemplateFields;
  variables: readonly TemplateVariable[];
  sampleVars: Record<string, string>;
  hasOverride: boolean;
};

export default function EmailTemplateEditor(props: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<TemplateFields>(props.initialFields);
  const [hasOverride, setHasOverride] = useState(props.hasOverride);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testEmail, setTestEmail] = useState<string>("");
  const [testStatus, setTestStatus] = useState<{ kind: "ok" | "err"; message: string } | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const focusedField = useRef<FieldKey | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const greetingRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement | null>(null);
  const calloutTextRef = useRef<HTMLTextAreaElement | null>(null);
  const closingTextRef = useRef<HTMLTextAreaElement | null>(null);
  const footerNoteRef = useRef<HTMLTextAreaElement | null>(null);

  function getFieldElement(key: FieldKey): HTMLInputElement | HTMLTextAreaElement | null {
    switch (key) {
      case "subject":
        return subjectRef.current;
      case "greeting":
        return greetingRef.current;
      case "bodyText":
        return bodyTextRef.current;
      case "calloutText":
        return calloutTextRef.current;
      case "closingText":
        return closingTextRef.current;
      case "footerNote":
        return footerNoteRef.current;
      default:
        return null;
    }
  }

  const dirty = useMemo(() => fieldsAreDifferent(fields, props.initialFields), [fields, props.initialFields]);

  const refreshPreview = useCallback(
    async (snapshot: TemplateFields) => {
      previewAbortRef.current?.abort();
      const ctrl = new AbortController();
      previewAbortRef.current = ctrl;
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/platform/email-templates/${encodeURIComponent(props.type)}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fields: snapshot }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { html: string };
        setPreviewHtml(data.html);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setPreviewHtml(`<pre style="padding:12px;color:#dc2626;">Greška: ${(e as Error).message}</pre>`);
      } finally {
        setPreviewLoading(false);
      }
    },
    [props.type],
  );

  // Initial preview + debounced refresh on changes.
  useEffect(() => {
    void refreshPreview(fields);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refreshPreview(fields);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [fields, refreshPreview]);

  function setField(key: FieldKey, value: string | null) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSavedFlash(null);
  }

  function insertVariableAtCursor(varName: string) {
    const target = focusedField.current ?? "bodyText";
    const el = getFieldElement(target);
    const placeholder = `{{${varName}}}`;
    const current = (fields[target] ?? "") as string;

    if (el && "selectionStart" in el && el.selectionStart !== null && el.selectionEnd !== null) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = current.slice(0, start) + placeholder + current.slice(end);
      setField(target, next);
      window.requestAnimationFrame(() => {
        el.focus();
        const cursor = start + placeholder.length;
        el.setSelectionRange(cursor, cursor);
      });
    } else {
      setField(target, current + placeholder);
    }
  }

  async function onSave() {
    setSaving(true);
    setTestStatus(null);
    try {
      const res = await fetch(`/api/platform/email-templates/${encodeURIComponent(props.type)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setHasOverride(true);
      setSavedFlash("Spremljeno.");
      router.refresh();
    } catch (e) {
      setSavedFlash(`Greška: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function onResetToDefault() {
    if (!window.confirm("Sigurno vratiti predložak na zadani sadržaj? Trenutni override se briše.")) return;
    setResetting(true);
    setTestStatus(null);
    try {
      const res = await fetch(`/api/platform/email-templates/${encodeURIComponent(props.type)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setFields(props.defaults);
      setHasOverride(false);
      setSavedFlash("Vraćeno na zadano.");
      router.refresh();
    } catch (e) {
      setSavedFlash(`Greška: ${(e as Error).message}`);
    } finally {
      setResetting(false);
    }
  }

  async function onSendTest() {
    if (!testEmail.trim()) {
      setTestStatus({ kind: "err", message: "Unesite email adresu." });
      return;
    }
    setTestStatus({ kind: "ok", message: "Šaljem test mail..." });
    try {
      const res = await fetch(`/api/platform/email-templates/${encodeURIComponent(props.type)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail.trim(), fields }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; transport?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setTestStatus({ kind: "ok", message: `Poslano (${data.transport ?? "ok"}).` });
    } catch (e) {
      setTestStatus({ kind: "err", message: `Greška: ${(e as Error).message}` });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* LEFT: form */}
      <section className="surface space-y-5 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Sadržaj</h2>
          <span
            className={
              hasOverride
                ? "inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200"
                : "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
            }
          >
            {hasOverride ? "Override aktivan" : "Default"}
          </span>
        </div>

        <FieldInput
          ref={subjectRef}
          label="Subject (predmet)"
          value={fields.subject}
          onChange={(v) => setField("subject", v)}
          onFocus={() => (focusedField.current = "subject")}
        />

        <FieldTextarea
          ref={greetingRef}
          label="Pozdrav"
          value={fields.greeting}
          rows={2}
          onChange={(v) => setField("greeting", v)}
          onFocus={() => (focusedField.current = "greeting")}
        />

        <FieldTextarea
          ref={bodyTextRef}
          label="Glavni tekst"
          value={fields.bodyText}
          rows={5}
          onChange={(v) => setField("bodyText", v)}
          onFocus={() => (focusedField.current = "bodyText")}
          help="HTML oznake <strong> i <br/> su dozvoljene; placeholderi {{ime}} se zamjenjuju u trenutku slanja."
        />

        <FieldTextarea
          ref={calloutTextRef}
          label="Naglašena poruka (callout)"
          value={fields.calloutText}
          rows={3}
          onChange={(v) => setField("calloutText", v)}
          onFocus={() => (focusedField.current = "calloutText")}
        />

        <FieldTextarea
          ref={closingTextRef}
          label="Zaključak"
          value={fields.closingText}
          rows={3}
          onChange={(v) => setField("closingText", v)}
          onFocus={() => (focusedField.current = "closingText")}
        />

        <FieldTextarea
          ref={footerNoteRef}
          label="Footer napomena (opcionalno)"
          value={fields.footerNote ?? ""}
          rows={2}
          onChange={(v) => setField("footerNote", v.trim() === "" ? null : v)}
          onFocus={() => (focusedField.current = "footerNote")}
        />

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Varijable</div>
          <p className="mt-1 text-xs text-slate-600">
            Klikom umećeš varijablu na trenutnu poziciju kursora u zadnjem aktivnom polju.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {props.variables.map((v) => (
              <li key={v.name}>
                <button
                  type="button"
                  onClick={() => insertVariableAtCursor(v.name)}
                  title={`${v.description} (npr. ${v.example})`}
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-800 shadow-sm hover:border-red-300 hover:bg-red-50"
                >
                  {`{{${v.name}}}`}
                </button>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 text-xs text-slate-600">
            {props.variables.map((v) => (
              <div key={`d-${v.name}`} className="flex gap-2">
                <dt className="min-w-[110px] font-mono text-slate-700">{v.name}</dt>
                <dd>{v.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            className="btn btn-primary px-4"
            onClick={onSave}
            disabled={saving || !dirty}
          >
            {saving ? "Spremam..." : "Spremi"}
          </button>
          <button
            type="button"
            className="btn btn-outline px-4"
            onClick={onResetToDefault}
            disabled={resetting || !hasOverride}
            title={hasOverride ? "Vrati na zadani sadržaj" : "Trenutno već koristiš zadani sadržaj"}
          >
            {resetting ? "Vraćam..." : "Vrati na zadano"}
          </button>
          {savedFlash && (
            <span
              className={
                savedFlash.startsWith("Greška") ? "text-xs text-red-600" : "text-xs text-emerald-700"
              }
            >
              {savedFlash}
            </span>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pošalji test mail</div>
          <p className="mt-1 text-xs text-slate-600">
            Šalje se trenutni (neutralni) sadržaj iz forme s primjerima varijabli. Subject je
            prefixiran s [TEST].
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              className="input h-9 w-72"
              placeholder="ime@domena.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
            />
            <button type="button" className="btn btn-outline h-9 px-3 text-sm" onClick={onSendTest}>
              Pošalji test
            </button>
            {testStatus && (
              <span
                className={
                  testStatus.kind === "ok" ? "text-xs text-emerald-700" : "text-xs text-red-600"
                }
              >
                {testStatus.message}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT: live preview */}
      <section className="surface space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Live preview</h2>
          {previewLoading && <span className="text-xs text-slate-500">Renderiram...</span>}
        </div>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="block h-[720px] w-full border-0 bg-white"
          />
        </div>
        <p className="text-xs text-slate-500">
          Sample varijable se koriste samo za prikaz; pri stvarnom slanju popunjavaju se iz konteksta.
        </p>
      </section>
    </div>
  );
}

function fieldsAreDifferent(a: TemplateFields, b: TemplateFields): boolean {
  return (
    a.subject !== b.subject ||
    a.greeting !== b.greeting ||
    a.bodyText !== b.bodyText ||
    a.calloutText !== b.calloutText ||
    a.closingText !== b.closingText ||
    (a.footerNote ?? "") !== (b.footerNote ?? "")
  );
}

const FieldInput = forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: string;
    onChange: (v: string) => void;
    onFocus: () => void;
    help?: string;
  }
>(function FieldInput({ label, value, onChange, onFocus, help }, ref) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        ref={ref}
        type="text"
        className="input mt-1 w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      {help ? <span className="mt-1 block text-xs text-slate-500">{help}</span> : null}
    </label>
  );
});

const FieldTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    label: string;
    value: string;
    rows: number;
    onChange: (v: string) => void;
    onFocus: () => void;
    help?: string;
  }
>(function FieldTextarea({ label, value, rows, onChange, onFocus, help }, ref) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <textarea
        ref={ref}
        className="input mt-1 w-full"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      {help ? <span className="mt-1 block text-xs text-slate-500">{help}</span> : null}
    </label>
  );
});
