"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Initial = {
  enabled: boolean;
  apiUsername: string;
  hasPassword: boolean;
  hasToken: boolean;
  paymentMethod: string;
  paymentDueDays: number;
  labelKompletCode: string;
  labelKompletName: string;
  labelKompletPrice: string;
  lastTestOkAt: string | null;
};

const PAYMENT_METHODS = [
  { value: "bankTransfer", label: "Transakcijski račun (virman)" },
  { value: "cash", label: "Gotovina" },
  { value: "creditCard", label: "Kartica" },
];

export default function ERacuniSettingsSection({ initial }: { initial: Initial }) {
  const router = useRouter();

  const [enabled, setEnabled] = useState(initial.enabled);
  const [apiUsername, setApiUsername] = useState(initial.apiUsername);
  const [apiPassword, setApiPassword] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod);
  const [paymentDueDays, setPaymentDueDays] = useState(String(initial.paymentDueDays));
  const [labelKompletCode, setLabelKompletCode] = useState(initial.labelKompletCode);
  const [labelKompletName, setLabelKompletName] = useState(initial.labelKompletName);
  const [labelKompletPrice, setLabelKompletPrice] = useState(initial.labelKompletPrice);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/eracuni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          apiUsername,
          apiPassword,
          apiToken,
          paymentMethod,
          paymentDueDays: Number(paymentDueDays),
          labelKompletCode,
          labelKompletName,
          labelKompletPrice,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({ tone: "err", text: data.error ?? "Spremanje nije uspjelo." });
        return;
      }
      setMessage({
        tone: "ok",
        text: enabled
          ? "Postavke spremljene — veza s e-računima je provjerena i radi."
          : "Postavke spremljene (integracija je isključena).",
      });
      setApiPassword("");
      setApiToken("");
      router.refresh();
    } catch {
      setMessage({ tone: "err", text: "Greška u komunikaciji. Pokušajte ponovno." });
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Ukloniti spremljene e-računi kredencijale i isključiti integraciju?")) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/eracuni", { method: "DELETE" });
      if (res.ok) {
        setEnabled(false);
        setApiUsername("");
        setMessage({ tone: "ok", text: "Integracija je isključena, kredencijali su uklonjeni." });
        router.refresh();
      } else {
        setMessage({ tone: "err", text: "Isključivanje nije uspjelo." });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface max-w-3xl space-y-5 p-5">
      {message ? (
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            message.tone === "ok"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Status integracije</div>
          <div className="mt-0.5 text-xs text-slate-500">
            {initial.enabled
              ? `Aktivna${initial.lastTestOkAt ? ` — zadnja uspješna provjera ${new Date(initial.lastTestOkAt).toLocaleString("hr-HR")}` : ""}`
              : "Nije aktivna"}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          Uključi integraciju
        </label>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-sm font-semibold text-slate-900">API pristup</div>
        <p className="mt-0.5 text-xs text-slate-500">
          Podatke nađete u e-računima: Postavke → Moje postavke → Aktivacija API pristupa. Lozinka i
          token spremaju se šifrirano; pri izmjeni ostavite prazno da zadržite postojeće.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Korisničko ime</span>
            <input
              className="input w-full"
              value={apiUsername}
              onChange={(e) => setApiUsername(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">API lozinka (secretKey)</span>
            <input
              className="input w-full"
              type="password"
              value={apiPassword}
              onChange={(e) => setApiPassword(e.target.value)}
              placeholder={initial.hasPassword ? "•••••• (spremljena)" : ""}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Token organizacije</span>
            <input
              className="input w-full"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={initial.hasToken ? "•••••• (spremljen)" : ""}
              autoComplete="new-password"
            />
          </label>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-sm font-semibold text-slate-900">Zadane postavke računa</div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Način plaćanja</span>
            <select
              className="input w-full"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Rok plaćanja (dana)</span>
            <input
              className="input w-full"
              type="number"
              min={0}
              max={365}
              value={paymentDueDays}
              onChange={(e) => setPaymentDueDays(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-4">
        <div className="text-sm font-semibold text-slate-900">Naljepnice na računu</div>
        <p className="mt-0.5 text-xs text-slate-500">
          Na račun ide jedna stavka po svakom pregledanom aparatu (npr. „Komplet naljepnica”, šifra
          3860). Šifra mora postojati i u e-računima.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Šifra artikla</span>
            <input
              className="input w-full"
              value={labelKompletCode}
              onChange={(e) => setLabelKompletCode(e.target.value)}
              placeholder="npr. 3860"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Naziv stavke</span>
            <input
              className="input w-full"
              value={labelKompletName}
              onChange={(e) => setLabelKompletName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-600">Cijena bez PDV-a (€)</span>
            <input
              className="input w-full"
              type="number"
              min={0}
              step="0.01"
              value={labelKompletPrice}
              onChange={(e) => setLabelKompletPrice(e.target.value)}
              placeholder="npr. 4.00"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <button
          type="button"
          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
          onClick={disconnect}
          disabled={saving || (!initial.hasPassword && !initial.hasToken)}
        >
          Ukloni kredencijale
        </button>
        <button type="button" className="btn btn-primary px-5" onClick={save} disabled={saving}>
          {saving ? "Spremam..." : "Spremi postavke"}
        </button>
      </div>
    </div>
  );
}
