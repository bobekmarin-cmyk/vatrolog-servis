"use client";

import { useEffect, useState } from "react";

type TabKey = "email" | "branding" | "health";

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
    ["email", "branding", "health"].includes(props.initialTab) ? props.initialTab : "email",
  );

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabBtn active={tab === "email"} onClick={() => setTab("email")} label="Email integracija" />
        <TabBtn active={tab === "branding"} onClick={() => setTab("branding")} label="Branding" />
        <TabBtn active={tab === "health"} onClick={() => setTab("health")} label="Health" />
      </nav>

      {tab === "email" && (
        <EmailTab vendor={props.vendor} flash={props.gmailFlash} reason={props.gmailReason} />
      )}
      {tab === "branding" && <BrandingTab initial={props.branding} />}
      {tab === "health" && <HealthTab />}
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
    } catch (e: any) {
      setErr(e.message ?? "Slanje neuspješno.");
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
    } catch (e: any) {
      alert(e.message);
      setPending(false);
    }
  };

  return (
    <section className="surface space-y-5 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vendor Gmail</h2>
          <p className="text-sm text-slate-500">
            Vendor mail (`marin@vatrolog.com`) za sve sistemske mailove: reset lozinki, pozivnice,
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
    } catch (e: any) {
      setErr(e.message ?? "Spremanje neuspješno.");
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
          placeholder="marin@vatrolog.com"
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

function HealthTab() {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/platform/health", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Greška.");
      setData(d);
    } catch (e: any) {
      setErr(e.message ?? "Greška.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="surface space-y-5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Health pregled</h2>
          <p className="text-sm text-slate-500">DB, vendor Gmail, SMTP fallback i Stripe webhook konfiguracija.</p>
        </div>
        <button type="button" className="btn btn-outline px-3" onClick={load} disabled={loading}>
          {loading ? "Učitavam…" : "Osvježi"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <HealthCard
            title="Baza"
            ok={!!data.db?.ok}
            okLabel={`OK · ${data.db?.latencyMs ?? "?"} ms`}
            failLabel="Nedostupna"
          />
          <HealthCard
            title="Vendor Gmail"
            ok={!!data.vendorGmail?.connected}
            okLabel={data.vendorGmail?.email ?? "Spojen"}
            failLabel="Nije spojen"
          />
          <HealthCard
            title="SMTP fallback"
            ok={!!data.smtp?.configured}
            okLabel={`Konfiguriran · ${data.smtp?.host ?? ""}`}
            failLabel="Nije konfiguriran"
          />
          <HealthCard
            title="Stripe"
            ok={!!data.stripe?.configured && !!data.stripe?.webhookConfigured}
            okLabel="Webhook konfiguriran"
            failLabel={data.stripe?.configured ? "Webhook fali" : "Nije konfiguriran"}
          />
          <HealthCard
            title="Google OAuth env"
            ok={!!data.env?.googleClient}
            okLabel="ID i secret postavljeni"
            failLabel="Nedostaju varijable"
          />
          <HealthCard
            title="Auth secrets"
            ok={!!data.env?.authSecret && !!data.env?.platformAuthSecret}
            okLabel="AUTH_SECRET i PLATFORM_AUTH_SECRET postavljeni"
            failLabel="Nedostaje secret"
          />
        </div>
      )}
    </section>
  );
}

function HealthCard({ title, ok, okLabel, failLabel }: { title: string; ok: boolean; okLabel: string; failLabel: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{title}</div>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          <span className={["h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500"].join(" ")} />
          {ok ? "OK" : "Provjeri"}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-600">{ok ? okLabel : failLabel}</div>
    </div>
  );
}
