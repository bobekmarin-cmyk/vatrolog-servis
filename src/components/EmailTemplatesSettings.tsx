"use client";

import { useEffect, useMemo, useState } from "react";
import { useDialog } from "@/components/ui/useDialog";

interface Template {
  id: string;
  type: string;
  label: string;
  subject: string;
  greeting: string;
  bodyText: string;
  calloutText: string;
  closingText: string;
  footerNote: string | null;
}

interface Props {
  templates: Template[];
}

const TYPE_ORDER = [
  "BEGINNING",
  "BEFORE_EXPIRY",
  "AFTER_EXPIRY",
  "RECEIPT",
  "REGISTER",
  "DELIVERY_NOTE",
];
const PLACEHOLDERS_BY_TYPE: Record<string, string[]> = {
  BEGINNING: ["{mjesec}", "{broj}", "{kupac}", "{tvrtka}"],
  BEFORE_EXPIRY: ["{mjesec}", "{broj}", "{kupac}", "{tvrtka}"],
  AFTER_EXPIRY: ["{mjesec}", "{broj}", "{kupac}", "{tvrtka}"],
  REGISTER: ["{nalog}", "{broj}", "{kupac}", "{tvrtka}"],
  RECEIPT: ["{nalog}", "{broj}", "{kupac}", "{tvrtka}"],
  DELIVERY_NOTE: ["{nalog}", "{broj}", "{kupac}", "{tvrtka}"],
};
const THEME_BY_TYPE: Record<string, { borderColor: string; bgColor: string; textColor: string; headerText: string }> = {
  BEGINNING: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Obavijest o servisu vatrogasnih aparata",
  },
  BEFORE_EXPIRY: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Obavijest o servisu vatrogasnih aparata",
  },
  AFTER_EXPIRY: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Obavijest o servisu vatrogasnih aparata",
  },
  REGISTER: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Upisnik servisiranih vatrogasnih aparata",
  },
  RECEIPT: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Primka vatrogasnih aparata",
  },
  DELIVERY_NOTE: {
    borderColor: "border-red-600",
    bgColor: "bg-red-50",
    textColor: "text-red-900",
    headerText: "Otpremnica vatrogasnih aparata",
  },
};

type EditField = "subject" | "greeting" | "bodyText" | "calloutText" | "closingText" | "footerNote" | null;

function TemplateEditor({ tpl, onSaved }: { tpl: Template; onSaved: (t: Template) => void }) {
  const dialog = useDialog();
  const theme = THEME_BY_TYPE[tpl.type] ?? THEME_BY_TYPE.BEGINNING;
  const placeholders = PLACEHOLDERS_BY_TYPE[tpl.type] ?? PLACEHOLDERS_BY_TYPE.BEGINNING;
  const [subject, setSubject] = useState(tpl.subject);
  const [greeting, setGreeting] = useState(tpl.greeting);
  const [bodyText, setBodyText] = useState(tpl.bodyText);
  const [calloutText, setCalloutText] = useState(tpl.calloutText);
  const [closingText, setClosingText] = useState(tpl.closingText);
  const [footerNote, setFooterNote] = useState(tpl.footerNote ?? "");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editing, setEditing] = useState<EditField>(null);

  useEffect(() => {
    setSubject(tpl.subject);
    setGreeting(tpl.greeting);
    setBodyText(tpl.bodyText);
    setCalloutText(tpl.calloutText);
    setClosingText(tpl.closingText);
    setFooterNote(tpl.footerNote ?? "");
    setEditing(null);
    setMessage(null);
  }, [tpl.id, tpl.type, tpl.subject, tpl.greeting, tpl.bodyText, tpl.calloutText, tpl.closingText, tpl.footerNote]);

  const isDirty =
    subject !== tpl.subject ||
    greeting !== tpl.greeting ||
    bodyText !== tpl.bodyText ||
    calloutText !== tpl.calloutText ||
    closingText !== tpl.closingText ||
    (footerNote || "") !== (tpl.footerNote || "");

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/email-templates/${tpl.type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          greeting,
          bodyText,
          calloutText,
          closingText,
          footerNote: footerNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Greška");
      onSaved(data.template);
      setMessage({ type: "ok", text: "Spremljeno!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Greška" });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const ok = await dialog.confirm({
      title: "Vratiti na zadane vrijednosti?",
      message: "Sve izmjene ovog predloška bit će izgubljene i vraćene na tvorničke postavke.",
      danger: true,
      confirmLabel: "Vrati",
    });
    if (!ok) return;
    setResetting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/email-templates/${tpl.type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Greška");
      const t = data.template as Template;
      setSubject(t.subject);
      setGreeting(t.greeting);
      setBodyText(t.bodyText);
      setCalloutText(t.calloutText);
      setClosingText(t.closingText);
      setFooterNote(t.footerNote ?? "");
      onSaved(t);
      setEditing(null);
      setMessage({ type: "ok", text: "Vraćeno na zadano!" });
      setTimeout(() => setMessage(null), 3000);
    } catch (e: unknown) {
      setMessage({ type: "err", text: e instanceof Error ? e.message : "Greška" });
    } finally {
      setResetting(false);
    }
  }

  function InlineEdit({
    field,
    value,
    onChange,
    rows = 1,
    children,
  }: {
    field: EditField;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
    children: React.ReactNode;
  }) {
    if (editing === field) {
      return (
        <textarea
          className="w-full resize-none rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditing(null);
          }}
          autoFocus
        />
      );
    }
    return (
      <div
        className="group/ie cursor-text rounded-lg px-1 py-0.5 transition-colors hover:bg-slate-100"
        onClick={() => setEditing(field)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setEditing(field);
          }
        }}
      >
        {children}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="ml-1.5 inline text-slate-300 opacity-0 transition-opacity group-hover/ie:opacity-100"
          aria-hidden
        >
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-slate-500">Predmet</span>
          {editing === "subject" ? (
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-200"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onBlur={() => setEditing(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Enter") setEditing(null);
              }}
              autoFocus
            />
          ) : (
            <span
              className="group/sub min-w-0 flex-1 cursor-text rounded px-1 py-0.5 text-slate-800 hover:bg-slate-100"
              onClick={() => setEditing("subject")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditing("subject");
                }
              }}
            >
              {subject}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="ml-1 inline text-slate-300 opacity-0 transition-opacity group-hover/sub:opacity-100"
                aria-hidden
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </span>
          )}
        </div>
      </div>

      <div className="px-5 py-4" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <div className={`mb-4 border-b-[3px] ${theme.borderColor} pb-2.5`}>
          <div className={`text-base font-bold ${theme.borderColor.replace("border-", "text-")}`}>{"{ tvrtka }"}</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{theme.headerText}</div>
        </div>

        <InlineEdit field="greeting" value={greeting} onChange={setGreeting}>
          <p className="text-sm text-slate-700">{greeting}</p>
        </InlineEdit>

        <InlineEdit field="bodyText" value={bodyText} onChange={setBodyText} rows={3}>
          <p className="text-sm leading-relaxed text-slate-700">{bodyText}</p>
        </InlineEdit>

        <div className="my-3">
          <InlineEdit field="calloutText" value={calloutText} onChange={setCalloutText} rows={2}>
            <div className={`rounded-md border-l-4 ${theme.borderColor} ${theme.bgColor} px-3 py-2`}>
              <p className={`text-sm font-semibold ${theme.textColor}`}>{calloutText}</p>
            </div>
          </InlineEdit>
        </div>

        <InlineEdit field="closingText" value={closingText} onChange={setClosingText} rows={2}>
          <p className="text-sm leading-relaxed text-slate-700">{closingText}</p>
        </InlineEdit>

        <div className="mt-5 border-t border-slate-100 pt-2.5">
          <p className="text-sm text-slate-500">S poštovanjem,</p>
          <p className="text-sm font-semibold text-slate-700">{"{ tvrtka }"}</p>
          {(footerNote || editing === "footerNote") && (
            <div className="mt-2">
              <InlineEdit field="footerNote" value={footerNote} onChange={setFooterNote}>
                <p className="text-[11px] italic text-slate-400">
                  {footerNote || "Podnožje (kliknite za uređivanje)"}
                </p>
              </InlineEdit>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {isDirty && (
            <button
              type="button"
              className="btn btn-primary px-4 py-1.5 text-xs"
              onClick={handleSave}
              disabled={saving || resetting}
            >
              {saving ? "Spremam…" : "Spremi promjene"}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost px-3 py-1.5 text-xs text-slate-600"
            onClick={handleReset}
            disabled={saving || resetting}
          >
            {resetting ? "Vraćam…" : "Vrati zadano"}
          </button>
          {message ? (
            <span className={`text-xs font-medium ${message.type === "ok" ? "text-emerald-600" : "text-red-600"}`}>
              {message.text}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1">
          {placeholders.map((p) => (
            <code key={p} className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200">
              {p}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EmailTemplatesSettings({ templates }: Props) {
  const [tpls, setTpls] = useState<Template[]>(templates);
  const sorted = useMemo(
    () => [...tpls].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)),
    [tpls],
  );
  const [selectedType, setSelectedType] = useState(() => {
    const s = [...templates].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
    return s[0]?.type ?? "";
  });
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (!sorted.some((t) => t.type === selectedType) && sorted[0]) {
      queueMicrotask(() => setSelectedType(sorted[0].type));
    }
  }, [sorted, selectedType]);

  const activeTpl = sorted.find((t) => t.type === selectedType) ?? sorted[0];

  function handleSaved(updated: Template) {
    setTpls((prev) => prev.map((t) => (t.type === updated.type ? updated : t)));
  }

  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="email-template-select">
              Predložak
            </label>
            <select
              id="email-template-select"
              className="select"
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setEditorOpen(false);
              }}
            >
              {sorted.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0 px-5"
            onClick={() => setEditorOpen((v) => !v)}
            aria-expanded={editorOpen}
          >
            {editorOpen ? "Zatvori uređivač" : "Uredi predložak"}
          </button>
        </div>
        {!editorOpen && activeTpl ? (
          <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-700">Predmet: </span>
            {activeTpl.subject}
          </p>
        ) : null}
      </div>

      {editorOpen && activeTpl ? (
        <div className="space-y-2">
          <TemplateEditor key={activeTpl.type} tpl={activeTpl} onSaved={handleSaved} />
          <p className="text-xs text-slate-500">
            Kliknite na dio teksta u pregledu za izmjenu. Dostupni su zamjenski tagovi ispod (npr.{" "}
            <code className="rounded bg-slate-100 px-1">{"{mjesec}"}</code>).
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Odaberite vrstu poruke gore i otvorite <strong>Uredi predložak</strong> kada želite mijenjati sadržaj.
        </p>
      )}
    </div>
  );
}
