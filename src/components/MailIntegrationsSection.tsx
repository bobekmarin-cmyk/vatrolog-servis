"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

type Provider = "GMAIL" | "SMTP";

export type MailIntegrationsStatus = {
  configured: boolean;
  activeProvider: Provider | null;
  preferredProvider: Provider | null;
  gmail: {
    configured: boolean;
    email: string | null;
    connectedAt: string | null;
  };
  smtp: {
    configured: boolean;
    host: string | null;
    port: number | null;
    secure: boolean | null;
    user: string | null;
    fromEmail: string | null;
    fromName: string | null;
    connectedAt: string | null;
  };
};

type Props = {
  initial: MailIntegrationsStatus;
};

const COMMON_PRESETS = [
  { id: "custom", label: "Vlastiti SMTP server", host: "", port: 587, secure: false, hint: "" },
  { id: "ht", label: "Hrvatski Telekom (HT/T-Com)", host: "mail.ht.hr", port: 465, secure: true, hint: "Korisničko ime je puna e-mail adresa (npr. ime.prezime@ht.hr ili @grad.t-com.hr). Ako 465/SSL ne radi, probajte port 587 sa isključenim SSL/TLS (STARTTLS)." },
  { id: "a1", label: "A1 (vip.hr / a1net.hr / xnet.hr)", host: "mail.a1net.hr", port: 587, secure: false, hint: "Za @vip.hr probajte mail.vip.hr; za @a1net.hr / @xnet.hr koristite mail.a1net.hr. Korisničko ime je puna e-mail adresa." },
  { id: "office365", label: "Microsoft 365 / Outlook", host: "smtp.office365.com", port: 587, secure: false, hint: "Microsoft 365: korisnik je vaša e-mail adresa. Ako imate 2FA, generirajte App password (Security → app passwords)." },
  { id: "gmail_smtp", label: "Gmail SMTP (app password)", host: "smtp.gmail.com", port: 587, secure: false, hint: "Generirajte app password u Google Account → Security → 2FA → App passwords." },
  { id: "yahoo", label: "Yahoo Mail", host: "smtp.mail.yahoo.com", port: 465, secure: true, hint: "Koristite app password (Yahoo Account Security → Generate app password)." },
];

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("hr-HR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function MailIntegrationsSection({ initial }: Props) {
  const router = useRouter();
  const dialog = useDialog();

  const [status, setStatus] = useState<MailIntegrationsStatus>(initial);
  const [smtpFormOpen, setSmtpFormOpen] = useState<boolean>(!initial.smtp.configured ? false : false);
  const [savingActive, setSavingActive] = useState<Provider | "AUTO" | null>(null);
  const [disconnecting, setDisconnecting] = useState<Provider | null>(null);

  // Refresh status from server (used after save / disconnect / switch).
  async function refreshStatus() {
    try {
      const res = await fetch("/api/mail/status", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as MailIntegrationsStatus;
        setStatus(data);
      }
    } catch {
      // ignore
    }
  }

  async function handleDisconnectGmail() {
    const ok = await dialog.confirm({
      title: "Odspojiti Gmail račun?",
      message:
        "Nećete moći slati obavijesti kupcima preko Gmaila dok ponovno ne povežete račun.",
      danger: true,
      confirmLabel: "Odspoji",
    });
    if (!ok) return;
    setDisconnecting("GMAIL");
    try {
      const res = await fetch("/api/gmail/disconnect", { method: "POST" });
      if (res.ok) {
        await refreshStatus();
        router.refresh();
      }
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleDisconnectSmtp() {
    const ok = await dialog.confirm({
      title: "Ukloniti SMTP postavke?",
      message:
        "Lozinka i postavke će biti obrisane. Možete ih ponovno unijeti kasnije.",
      danger: true,
      confirmLabel: "Ukloni",
    });
    if (!ok) return;
    setDisconnecting("SMTP");
    try {
      const res = await fetch("/api/mail/smtp", { method: "DELETE" });
      if (res.ok) {
        await refreshStatus();
        setSmtpFormOpen(false);
        router.refresh();
      }
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleSetActive(provider: Provider | "AUTO") {
    setSavingActive(provider);
    try {
      const res = await fetch("/api/mail/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        await refreshStatus();
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        await dialog.alert({
          title: "Greška",
          message: data?.error ?? "Nije moguće postaviti aktivnog providera.",
          variant: "danger",
        });
      }
    } finally {
      setSavingActive(null);
    }
  }

  const bothConfigured = status.gmail.configured && status.smtp.configured;

  return (
    <div className="space-y-6">
      {bothConfigured && (
        <ActiveProviderPicker
          status={status}
          saving={savingActive}
          onChange={handleSetActive}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GmailCard
          gmail={status.gmail}
          isActive={status.activeProvider === "GMAIL"}
          showActiveBadge={bothConfigured}
          disconnecting={disconnecting === "GMAIL"}
          onDisconnect={handleDisconnectGmail}
        />

        <SmtpCard
          smtp={status.smtp}
          isActive={status.activeProvider === "SMTP"}
          showActiveBadge={bothConfigured}
          disconnecting={disconnecting === "SMTP"}
          formOpen={smtpFormOpen}
          onOpenForm={() => setSmtpFormOpen(true)}
          onCloseForm={() => setSmtpFormOpen(false)}
          onSaved={async () => {
            await refreshStatus();
            setSmtpFormOpen(false);
            router.refresh();
          }}
          onDisconnect={handleDisconnectSmtp}
        />
      </div>
    </div>
  );
}

/* ============================================================
   ACTIVE PROVIDER PICKER
============================================================ */

function ActiveProviderPicker({
  status,
  saving,
  onChange,
}: {
  status: MailIntegrationsStatus;
  saving: Provider | "AUTO" | null;
  onChange: (provider: Provider | "AUTO") => void;
}) {
  const active = status.activeProvider;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-700">Aktivni servis za slanje</div>
      <p className="mt-1 text-xs text-slate-500">
        Imate konfigurirana oba servisa. Odaberite koji se koristi za slanje obavijesti kupcima.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <ActiveOption
          label="Gmail"
          subLabel={status.gmail.email ?? ""}
          selected={active === "GMAIL"}
          loading={saving === "GMAIL"}
          onClick={() => onChange("GMAIL")}
        />
        <ActiveOption
          label="SMTP"
          subLabel={status.smtp.fromEmail ?? status.smtp.user ?? ""}
          selected={active === "SMTP"}
          loading={saving === "SMTP"}
          onClick={() => onChange("SMTP")}
        />
      </div>
    </div>
  );
}

function ActiveOption({
  label,
  subLabel,
  selected,
  loading,
  onClick,
}: {
  label: string;
  subLabel: string;
  selected: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || selected}
      className={
        "flex min-w-[180px] flex-col items-start rounded-md border px-3 py-2 text-left text-sm transition-colors " +
        (selected
          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-white hover:border-slate-400")
      }
    >
      <span className="flex items-center gap-2 font-semibold">
        {selected && <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />}
        {label}
        {selected && <span className="text-xs font-medium text-emerald-700">(aktivno)</span>}
      </span>
      {subLabel && <span className="text-xs text-slate-500">{subLabel}</span>}
      {loading && <span className="text-xs text-slate-400">Spremam…</span>}
    </button>
  );
}

/* ============================================================
   GMAIL CARD
============================================================ */

function GmailCard({
  gmail,
  isActive,
  showActiveBadge,
  disconnecting,
  onDisconnect,
}: {
  gmail: MailIntegrationsStatus["gmail"];
  isActive: boolean;
  showActiveBadge: boolean;
  disconnecting: boolean;
  onDisconnect: () => void;
}) {
  return (
    <section className="surface flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GmailIcon />
            <h3 className="text-base font-semibold text-slate-800">Gmail (Google)</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Povezivanje preko Google OAuth — najjednostavnije ako koristite @gmail.com ili Google Workspace.
          </p>
        </div>
        {gmail.configured && (
          <StatusBadge active={isActive} showActiveLabel={showActiveBadge} />
        )}
      </header>

      {!gmail.configured ? (
        <div>
          <a
            href="/api/gmail/connect"
            className="btn btn-primary inline-flex items-center px-4"
          >
            Poveži Gmail račun
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div>
            <div className="text-sm font-medium text-emerald-800">{gmail.email}</div>
            {gmail.connectedAt && (
              <div className="text-xs text-emerald-700/80">
                Povezano: {formatDate(gmail.connectedAt)}
              </div>
            )}
          </div>
          <button
            type="button"
            className="btn btn-outline px-3 text-xs text-red-600 border-red-300 hover:bg-red-50"
            onClick={onDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? "Odspajam…" : "Odspoji"}
          </button>
        </div>
      )}
    </section>
  );
}

/* ============================================================
   SMTP CARD
============================================================ */

function SmtpCard({
  smtp,
  isActive,
  showActiveBadge,
  disconnecting,
  formOpen,
  onOpenForm,
  onCloseForm,
  onSaved,
  onDisconnect,
}: {
  smtp: MailIntegrationsStatus["smtp"];
  isActive: boolean;
  showActiveBadge: boolean;
  disconnecting: boolean;
  formOpen: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onSaved: () => void;
  onDisconnect: () => void;
}) {
  return (
    <section className="surface flex flex-col gap-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SmtpIcon />
            <h3 className="text-base font-semibold text-slate-800">SMTP (vlastita domena)</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Koristite vlastiti SMTP server (npr. <span className="font-medium">info@moj-servis.hr</span>).
            Radi s Zoho, Microsoft 365, cPanel hostingom i sl.
          </p>
        </div>
        {smtp.configured && !formOpen && (
          <StatusBadge active={isActive} showActiveLabel={showActiveBadge} />
        )}
      </header>

      {smtp.configured && !formOpen && (
        <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-emerald-800">
                {smtp.fromEmail ?? smtp.user}
              </div>
              <div className="text-xs text-emerald-700/80">
                {smtp.host}:{smtp.port} {smtp.secure ? "(SSL/TLS)" : "(STARTTLS)"}
                {smtp.connectedAt && ` • Povezano: ${formatDate(smtp.connectedAt)}`}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="btn btn-outline px-3 text-xs"
              onClick={onOpenForm}
            >
              Uredi postavke
            </button>
            <SmtpTestButton fromEmail={smtp.fromEmail ?? smtp.user ?? ""} />
            <button
              type="button"
              className="btn btn-outline px-3 text-xs text-red-600 border-red-300 hover:bg-red-50"
              onClick={onDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? "Uklanjam…" : "Ukloni"}
            </button>
          </div>
        </div>
      )}

      {!smtp.configured && !formOpen && (
        <div>
          <button
            type="button"
            className="btn btn-primary inline-flex items-center px-4"
            onClick={onOpenForm}
          >
            Poveži vlastiti mail
          </button>
        </div>
      )}

      {formOpen && (
        <SmtpForm
          initial={smtp}
          onCancel={onCloseForm}
          onSaved={onSaved}
        />
      )}
    </section>
  );
}

/* ============================================================
   SMTP FORM
============================================================ */

function SmtpForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: MailIntegrationsStatus["smtp"];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [host, setHost] = useState(initial.host ?? "");
  const [port, setPort] = useState<number>(initial.port ?? 587);
  const [secure, setSecure] = useState<boolean>(initial.secure ?? false);
  const [user, setUser] = useState(initial.user ?? "");
  const [password, setPassword] = useState("");
  const [fromEmail, setFromEmail] = useState(initial.fromEmail ?? "");
  const [fromName, setFromName] = useState(initial.fromName ?? "");
  const [presetId, setPresetId] = useState<string>("custom");
  const [presetHint, setPresetHint] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const passwordPlaceholder = useMemo(
    () => (initial.host ? "(ostavite prazno da zadržite postojeću)" : ""),
    [initial.host],
  );

  function applyPreset(id: string) {
    setPresetId(id);
    const preset = COMMON_PRESETS.find((p) => p.id === id);
    if (preset && preset.id !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
      setSecure(preset.secure);
      setPresetHint(preset.hint);
    } else {
      setPresetHint("");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorDetail(null);

    if (!password && !initial.host) {
      setError("Lozinka je obavezna pri prvom unosu.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/mail/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port),
          secure,
          user: user.trim(),
          // Ako je polje prazno i postoji već spremljena konfiguracija, server treba
          // dobiti postojeću lozinku. Ali pošto smo na klijentu, šaljemo prazno i
          // server vraća grešku 'lozinka je obavezna' — pa ovdje moramo odbiti spremanje.
          // Workaround: forsiraj korisnika da unese lozinku i kod editiranja.
          password,
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Spremanje nije uspjelo.");
        if (data?.detail) setErrorDetail(String(data.detail));
        return;
      }
      onSaved();
      await dialog.alert({
        title: "Spremljeno",
        message:
          "SMTP postavke su spremljene i provjerene. Sad možete poslati testnu poruku.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError("Greška: " + msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
      <div>
        <label className="label">Predložak</label>
        <select
          className="input"
          value={presetId}
          onChange={(e) => applyPreset(e.target.value)}
        >
          {COMMON_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {presetHint && <p className="mt-1 text-xs text-slate-500">{presetHint}</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="label">SMTP host</label>
          <input
            className="input"
            placeholder="npr. smtp.vasadomena.hr"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Port</label>
          <input
            type="number"
            className="input"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="smtp_secure"
          type="checkbox"
          checked={secure}
          onChange={(e) => setSecure(e.target.checked)}
        />
        <label htmlFor="smtp_secure" className="text-sm text-slate-700">
          SSL/TLS (port 465). Za 587 ili 25 ostavite isključeno (STARTTLS).
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Korisničko ime</label>
          <input
            className="input"
            placeholder="npr. info@vasadomena.hr"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Lozinka</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              className="input pr-16"
              placeholder={passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required={!initial.host}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? "Sakrij" : "Prikaži"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label">From e-mail (po želji)</label>
          <input
            className="input"
            placeholder="npr. info@vasadomena.hr"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Adresa koja se prikazuje primatelju. Ako ostavite prazno, koristi se korisničko ime.
          </p>
        </div>
        <div>
          <label className="label">From naziv (po želji)</label>
          <input
            className="input"
            placeholder="npr. Moj Servis d.o.o."
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Ime tvrtke uz e-mail. Ako ostavite prazno, koristi se naziv tvrtke iz postavki.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <div className="font-medium">{error}</div>
          {errorDetail && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{errorDetail}</pre>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" className="btn btn-primary px-4" disabled={saving}>
          {saving ? "Provjeravam i spremam…" : "Spremi i provjeri"}
        </button>
        <button type="button" className="btn btn-outline px-3 text-sm" onClick={onCancel}>
          Odustani
        </button>
      </div>
    </form>
  );
}

/* ============================================================
   SMTP TEST BUTTON
============================================================ */

function SmtpTestButton({ fromEmail }: { fromEmail: string }) {
  const dialog = useDialog();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function handleSend() {
    if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
      await dialog.alert({
        title: "Greška",
        message: "Unesite ispravnu e-mail adresu primatelja.",
        variant: "danger",
      });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/mail/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipient }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await dialog.alert({
          title: "Slanje nije uspjelo",
          message: (data?.detail ?? data?.error ?? "Nepoznata greška.") as string,
          variant: "danger",
        });
        return;
      }
      setOpen(false);
      setRecipient("");
      await dialog.alert({
        title: "Test poslan",
        message: `Test poruka je poslana na ${recipient}. Provjerite inbox (i spam folder).`,
      });
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-outline px-3 text-xs"
        onClick={() => {
          setRecipient(fromEmail);
          setOpen(true);
        }}
      >
        Pošalji test
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="email"
        className="input h-8 w-56 text-sm"
        placeholder="primatelj@example.com"
        value={recipient}
        onChange={(e) => setRecipient(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-primary px-3 text-xs"
        onClick={handleSend}
        disabled={sending}
      >
        {sending ? "Šaljem…" : "Pošalji"}
      </button>
      <button
        type="button"
        className="btn btn-outline px-3 text-xs"
        onClick={() => setOpen(false)}
      >
        Odustani
      </button>
    </div>
  );
}

/* ============================================================
   STATUS BADGE
============================================================ */

function StatusBadge({ active, showActiveLabel }: { active: boolean; showActiveLabel: boolean }) {
  if (active && showActiveLabel) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Aktivno
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      Povezano
    </span>
  );
}

/* ============================================================
   ICONS
============================================================ */

function GmailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M22 6.5v11A1.5 1.5 0 0 1 20.5 19h-2V9.84l-6.5 4.875L5.5 9.84V19h-2A1.5 1.5 0 0 1 2 17.5v-11A1.5 1.5 0 0 1 3.5 5h.5L12 11l8-6h.5A1.5 1.5 0 0 1 22 6.5Z" fill="#dc2626" />
    </svg>
  );
}

function SmtpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
