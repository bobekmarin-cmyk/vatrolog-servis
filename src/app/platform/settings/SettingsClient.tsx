"use client";

import { useState } from "react";
import Link from "next/link";

export type TabKey = "email" | "branding";

type VendorStatus = {
  connected: boolean;
  email: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  scope: string | null;
};

type Branding = {
  defaultFromName: string | null;
  defaultFromEmail: string | null;
  signatureHtml: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

export default function SettingsClient(props: {
  initialTab: TabKey;
  gmailFlash: string | null;
  gmailReason: string | null;
  vendor: VendorStatus;
  branding: Branding;
}) {
  const [tab, setTab] = useState<TabKey>(
    props.initialTab === "branding" ? "branding" : "email",
  );

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex flex-wrap gap-2">
          <TabBtn active={tab === "email"} onClick={() => setTab("email")} label="Email integracija" />
          <TabBtn active={tab === "branding"} onClick={() => setTab("branding")} label="Branding" />
        </div>
        <Link
          href="/platform/health"
          className="-mb-px rounded-t-lg border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Zdravlje sustava →
        </Link>
      </nav>

      {tab === "email" && (
        <EmailTab vendor={props.vendor} flash={props.gmailFlash} reason={props.gmailReason} />
      )}
      {tab === "branding" && <BrandingTab initial={props.branding} />}
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-red-600 text-red-600"
          : "border-transparent text-slate-500 hover:text-slate-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function EmailTab({
  vendor,
  flash,
  reason,
}: {
  vendor: VendorStatus;
  flash: string | null;
  reason: string | null;
}) {
  const [testTo, setTestTo] = useState("");
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sendTest = async () => {
    setPending(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/platform/gmail/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Slanje neuspješno.");
      setMsg("Testni mail poslan.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Slanje neuspješno.");
    } finally {
      setPending(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Stvarno odspojiti vendor Gmail?")) return;
    setPending(true);
    try {
      const res = await fetch("/api/platform/gmail/disconnect", {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("Disconnect neuspješan.");
      window.location.href = "/platform/settings?tab=email&gmail=disconnected";
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Greška.");
      setPending(false);
    }
  };

  return (
    <section className="surface space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vendor Gmail</h2>
          <p className="text-sm text-slate-500">
            Vendor mail (npr. <code>info@vatrolog.com</code>) za sve sistemske mailove: reset lozinki, pozivnice,
            verifikacije, podsjetnici pretplate.
          </p>
        </div>
        <span
          className={[
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            vendor.connected
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600",
          ].join(" ")}
        >
          <span
            className={[
              "h-2 w-2 rounded-full",
              vendor.connected ? "bg-emerald-500" : "bg-slate-400",
            ].join(" ")}
          />
          {vendor.connected ? "Spojen" : "Nije spojen"}
        </span>
      </div>

      {flash === "connected" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Gmail uspješno spojen.
        </div>
      )}
      {flash === "disconnected" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Gmail odspojen.
        </div>
      )}
      {flash === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Greška: {reason ?? "nepoznato"}.
        </div>
      )}

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-slate-400">Email</dt>
          <dd className="font-medium text-slate-800">{vendor.email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Spojeno</dt>
          <dd className="font-medium text-slate-800">
            {vendor.connectedAt ? new Date(vendor.connectedAt).toLocaleString("hr-HR") : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Token istječe</dt>
          <dd className="font-medium text-slate-800">
            {vendor.expiresAt ? new Date(vendor.expiresAt).toLocaleString("hr-HR") : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-400">Scope</dt>
          <dd className="break-all text-xs text-slate-600">{vendor.scope ?? "—"}</dd>
        </div>
      </dl>

      <VendorGmailDisclosure />

      <div className="flex flex-wrap gap-2">
        {!vendor.connected ? (
          <a className="btn btn-primary px-4" href="/api/platform/gmail/connect">
            Poveži Gmail
          </a>
        ) : (
          <>
            <a className="btn btn-outline px-4" href="/api/platform/gmail/connect">
              Ponovno autoriziraj
            </a>
            <button
              type="button"
              className="btn btn-outline px-4 text-red-600 hover:bg-red-50"
              onClick={disconnect}
              disabled={pending}
            >
              Odspoji
            </button>
          </>
        )}
      </div>

      {!vendor.connected && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Klikom na „Poveži Gmail” bit ćete preusmjereni na Googleov ekran za odobrenje pristupa.
          Povezivanjem prihvaćate{" "}
          <a
            href="/legal/privacy#google-api"
            className="underline hover:text-slate-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Politiku privatnosti
          </a>{" "}
          i{" "}
          <a
            href="/legal/google-api"
            className="underline hover:text-slate-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            opis Gmail integracije
          </a>
          .
        </p>
      )}
      {vendor.connected && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Odspajanjem brišemo OAuth tokene iz baze i opozivamo refresh token kod Googlea. Pristup
          možete dodatno opozvati i izravno na{" "}
          <a
            href="https://myaccount.google.com/permissions"
            className="underline hover:text-slate-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      )}

      {vendor.connected && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold">Testni mail</div>
          <p className="mt-1 text-xs text-slate-500">
            Pošalji kratku testnu poruku da provjeriš da kanal radi (rate-limit 5/min).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="email"
              className="input flex-1 min-w-[240px]"
              placeholder="primatelj@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary px-4"
              disabled={!testTo || pending}
              onClick={sendTest}
            >
              {pending ? "Šaljem…" : "Pošalji testni mail"}
            </button>
          </div>
          {msg && <div className="mt-2 text-xs text-emerald-600">{msg}</div>}
          {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
        </div>
      )}
    </section>
  );
}

function VendorGmailDisclosure() {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
      <p className="font-semibold text-slate-800">Što tražimo od Googlea:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>
          <code className="rounded bg-white px-1 text-[11px]">gmail.send</code> — slanje sistemskih
          mailova (reset lozinki, pozivnice, podsjetnici pretplate, alerti) iz vendor računa.
        </li>
        <li>
          <code className="rounded bg-white px-1 text-[11px]">userinfo.email</code> — prikaz adrese
          spojenog vendor računa u sučelju.
        </li>
      </ul>
      <p className="mt-2 font-semibold text-slate-800">Ne radimo:</p>
      <p>
        ne čitamo inbox, ne pohranjujemo tijela poruka, ne dijelimo Gmail podatke s trećim stranama,
        ne koristimo ih za oglašavanje ni za treniranje AI/ML modela. Korištenje je sukladno{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          className="underline hover:text-slate-900"
          target="_blank"
          rel="noopener noreferrer"
        >
          Google API Services User Data Policy
        </a>{" "}
        i Limited Use zahtjevima. Detalji:{" "}
        <a
          href="/legal/google-api"
          className="underline hover:text-slate-900"
          target="_blank"
          rel="noopener noreferrer"
        >
          Gmail integracija
        </a>
        .
      </p>
    </div>
  );
}

function BrandingTab({ initial }: { initial: Branding }) {
  const [form, setForm] = useState<Branding>(initial);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onChange = (k: keyof Branding) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setPending(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch("/api/platform/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultFromName: form.defaultFromName ?? null,
          defaultFromEmail: form.defaultFromEmail ?? null,
          signatureHtml: form.signatureHtml ?? null,
          logoUrl: form.logoUrl ?? null,
          brandColor: form.brandColor ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Spremanje neuspješno.");
      setMsg("Spremljeno.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Spremanje neuspješno.");
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="surface space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Branding sistemskih mailova</h2>
        <p className="text-sm text-slate-500">
          Ako su prazna, koriste se default vrijednosti iz <code>.env</code> (`VENDOR_FROM_NAME`,
          `VENDOR_FROM_EMAIL`).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="From name" value={form.defaultFromName ?? ""} onChange={onChange("defaultFromName")} placeholder="VatroLog" />
        <Field
          label="From email"
          type="email"
          value={form.defaultFromEmail ?? ""}
          onChange={onChange("defaultFromEmail")}
          placeholder="info@vatrolog.com"
        />
        <Field label="Logo URL" value={form.logoUrl ?? ""} onChange={onChange("logoUrl")} placeholder="https://…/logo.png" />
        <Field label="Brand color (hex)" value={form.brandColor ?? ""} onChange={onChange("brandColor")} placeholder="#dc2626" />
      </div>

      <div>
        <label className="text-xs font-medium uppercase text-slate-500">Signature (HTML)</label>
        <textarea
          className="input mt-1 h-32 w-full"
          value={form.signatureHtml ?? ""}
          onChange={onChange("signatureHtml")}
          placeholder="<p>Tim VatroLog</p>"
        />
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary px-4" onClick={save} disabled={pending}>
          {pending ? "Spremam…" : "Spremi"}
        </button>
        {msg && <span className="text-xs text-emerald-600">{msg}</span>}
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </section>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium uppercase text-slate-500">{props.label}</label>
      <input
        type={props.type ?? "text"}
        className="input mt-1 w-full"
        value={props.value}
        onChange={props.onChange}
        placeholder={props.placeholder}
      />
    </div>
  );
}
