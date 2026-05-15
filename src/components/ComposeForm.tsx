"use client";

import { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";

interface TemplateData {
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
  customerId: string;
  customerEmail: string;
  month: string;
  itemCount: number;
  companyName: string;
  customerName: string;
  /** Adresa s koje se mail šalje (Gmail / SMTP From). */
  fromAddress: string;
  monthLabel: string;
  templates: TemplateData[];
  defaultTemplateType: string;
  backUrl: string;
}

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{mjesec\}/g, vars.mjesec ?? "")
    .replace(/\{broj\}/g, vars.broj ?? "")
    .replace(/\{kupac\}/g, vars.kupac ?? "")
    .replace(/\{tvrtka\}/g, vars.tvrtka ?? "");
}

type EditingField = "greeting" | "bodyText" | "calloutText" | "closingText" | null;

export default function ComposeForm({
  customerId,
  customerEmail,
  month,
  itemCount,
  companyName,
  customerName,
  fromAddress,
  monthLabel,
  templates,
  defaultTemplateType,
  backUrl,
}: Props) {
  const router = useRouter();

  const vars = useMemo(
    () => ({
      mjesec: monthLabel,
      broj: String(itemCount),
      kupac: customerName,
      tvrtka: companyName,
    }),
    [monthLabel, itemCount, customerName, companyName],
  );

  const templateByType = useMemo(() => {
    const m = new Map<string, TemplateData>();
    for (const t of templates) m.set(t.type, t);
    return m;
  }, [templates]);

  const [selectedType, setSelectedType] = useState(defaultTemplateType);
  const [subject, setSubject] = useState(() => {
    const t = templateByType.get(defaultTemplateType);
    return t ? replacePlaceholders(t.subject, vars) : "";
  });
  const [greeting, setGreeting] = useState(() => {
    const t = templateByType.get(defaultTemplateType);
    return t ? replacePlaceholders(t.greeting, vars) : "Poštovani,";
  });
  const [bodyText, setBodyText] = useState(() => {
    const t = templateByType.get(defaultTemplateType);
    return t ? replacePlaceholders(t.bodyText, vars) : "";
  });
  const [calloutText, setCalloutText] = useState(() => {
    const t = templateByType.get(defaultTemplateType);
    return t ? replacePlaceholders(t.calloutText, vars) : "";
  });
  const [closingText, setClosingText] = useState(() => {
    const t = templateByType.get(defaultTemplateType);
    return t ? replacePlaceholders(t.closingText, vars) : "";
  });

  const [toEmail, setToEmail] = useState(customerEmail);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingField>(null);
  const editRef = useRef<HTMLTextAreaElement | null>(null);

  function handleTemplateChange(type: string) {
    setSelectedType(type);
    const t = templateByType.get(type);
    if (!t) return;
    setSubject(replacePlaceholders(t.subject, vars));
    setGreeting(replacePlaceholders(t.greeting, vars));
    setBodyText(replacePlaceholders(t.bodyText, vars));
    setCalloutText(replacePlaceholders(t.calloutText, vars));
    setClosingText(replacePlaceholders(t.closingText, vars));
    setEditing(null);
  }

  async function handleSend() {
    const trimmedEmail = toEmail.trim();
    if (!trimmedEmail) {
      setError("Unesite barem jednu email adresu");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/gmail/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          toEmail: trimmedEmail,
          month,
          itemCount,
          subject,
          greeting,
          bodyText,
          calloutText,
          closingText,
          templateType: selectedType,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Greška ${res.status}`);
      }
      router.push(backUrl + (backUrl.includes("?") ? "&" : "?") + "sent=1");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Nepoznata greška");
    } finally {
      setSending(false);
    }
  }

  const canSend = toEmail.trim() && subject.trim() && greeting.trim() && bodyText.trim() && calloutText.trim() && closingText.trim();

  function EditableBlock({
    field,
    value,
    onChange,
    rows = 2,
    className = "",
    children,
  }: {
    field: EditingField;
    value: string;
    onChange: (v: string) => void;
    rows?: number;
    className?: string;
    children: React.ReactNode;
  }) {
    const isEditing = editing === field;
    return isEditing ? (
      <textarea
        ref={editRef}
        className={`w-full resize-none rounded border border-blue-300 bg-blue-50/30 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(null);
        }}
        autoFocus
      />
    ) : (
      <div
        className={`group/edit cursor-text rounded px-2 py-1.5 transition-colors hover:bg-blue-50 hover:ring-1 hover:ring-blue-200 ${className}`}
        onClick={() => setEditing(field)}
        title="Kliknite za uređivanje"
      >
        {children}
        <span className="ml-2 inline-block opacity-0 transition-opacity group-hover/edit:opacity-100">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline text-blue-400">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Email compose window */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
            Nova poruka
          </div>
          <select
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-200"
            value={selectedType}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Header fields */}
        <div className="divide-y divide-slate-100 border-b border-slate-100 text-sm">
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Od</span>
            <span className="text-slate-600">{fromAddress}</span>
          </div>
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Prima</span>
            <div className="flex flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span className="inline-flex shrink-0 items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                  {customerName}
                </span>
                <input
                  type="text"
                  className="flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="email@primjer.hr"
                />
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">Više adresa odvojite zarezom</p>
            </div>
          </div>
          <div className="flex items-center gap-0 px-4 py-1.5">
            <span className="w-16 shrink-0 text-xs font-medium text-slate-400">Predmet</span>
            <input
              className="flex-1 border-0 bg-transparent p-0 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-0"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Unesite predmet..."
            />
          </div>
        </div>

        {/* Email body — visual inline editing */}
        <div className="px-6 py-5" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
          {/* Company header */}
          <div className="mb-5 border-b-[3px] border-red-600 pb-3">
            <div className="text-lg font-bold text-red-600">{companyName}</div>
            <div className="mt-0.5 text-xs text-slate-400">Obavijest o servisu vatrogasnih aparata</div>
          </div>

          {/* Greeting */}
          <EditableBlock field="greeting" value={greeting} onChange={setGreeting} rows={1}>
            <p className="text-sm text-slate-700">{greeting}</p>
          </EditableBlock>

          {/* Body text */}
          <EditableBlock field="bodyText" value={bodyText} onChange={setBodyText} rows={3} className="mt-2">
            <p className="text-sm leading-relaxed text-slate-700">{bodyText}</p>
          </EditableBlock>

          {/* Callout */}
          <div className="mt-4 mb-4">
            <EditableBlock field="calloutText" value={calloutText} onChange={setCalloutText} rows={2} className="!p-0">
              <div className="rounded-md border-l-4 border-red-600 bg-red-50 px-3.5 py-2.5">
                <p className="text-sm font-semibold text-red-900">{calloutText}</p>
              </div>
            </EditableBlock>
          </div>

          {/* Closing */}
          <EditableBlock field="closingText" value={closingText} onChange={setClosingText} rows={2}>
            <p className="text-sm leading-relaxed text-slate-700">{closingText}</p>
          </EditableBlock>

          {/* Signature */}
          <div className="mt-6 border-t border-slate-100 pt-3">
            <p className="text-sm text-slate-500">S poštovanjem,</p>
            <p className="text-sm font-semibold text-slate-700">{companyName}</p>
          </div>
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={sending || !canSend}
              onClick={handleSend}
            >
              {sending ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Šaljem…
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Pošalji
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">
              Kliknite na tekst maila za uređivanje
            </span>
            <a
              href={backUrl}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              </svg>
              Odustani
            </a>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Greška:</span> {error}
        </div>
      )}
    </div>
  );
}
