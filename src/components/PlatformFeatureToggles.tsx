"use client";

import { useState } from "react";

type FeatureState = {
  enabledForAdmin: boolean;
  enabledForWorkshop: boolean;
};

type Props = {
  companyId: string;
  features: Record<string, FeatureState>;
};

const MODULE_META: Record<string, { label: string; description: string; icon: string }> = {
  DASHBOARD: { label: "Dashboard", description: "Početna stranica sa statistikama i grafikonima", icon: "📊" },
  WORK_ORDERS: { label: "Radni nalozi", description: "Kreiranje, uređivanje i zaključavanje radnih naloga + otpremnice", icon: "🧾" },
  WAREHOUSE: { label: "Skladište", description: "Skladište rezervnih dijelova i servisnih naljepnica", icon: "📦" },
  QR_LABELS: { label: "QR naljepnice", description: "Generator QR naljepnica za aparate (PDF za ispis)", icon: "🔳" },
  EXTINGUISHERS: { label: "Aparati", description: "Evidencija svih vatrogasnih aparata", icon: "🧯" },
  CUSTOMERS: { label: "Kupci", description: "Upravljanje kupcima, odjelima i kontaktima", icon: "🏢" },
  CUSTOMER_PORTAL: { label: "Korisnički portal", description: "Pozivnice i upravljanje portal pristupom za kupce", icon: "🔑" },
  REPORTS_MONTHLY: { label: "Izvještaji", description: "Plan servisa, poslana pošta i servisna analitika", icon: "📅" },
  ADMIN_SERVICERS: { label: "Serviseri", description: "Upravljanje serviserima, PIN aktivacija", icon: "👷" },
  ADMIN_SETTINGS: { label: "Postavke", description: "Postavke tvrtke, šifrarnici, mail i integracije (e-računi)", icon: "⚙️" },
  CUSTOMER_ANALYTICS: { label: "Analitika kupaca", description: "Detaljni uvid u statistiku po kupcu", icon: "📈" },
  EMAIL_NOTIFICATIONS: { label: "Email obavijesti", description: "Automatsko slanje email obavijesti kupcima", icon: "✉️" },
  SALES_ORDERS: { label: "Prodajni nalozi", description: "Prodaja aparata i opreme (modul u pripremi)", icon: "🛒" },
  SALES_WAREHOUSE: { label: "Skladište – prodaja", description: "Skladište prodajne robe (modul u pripremi)", icon: "🏬" },
};

const KEY_ORDER = [
  "DASHBOARD",
  "WORK_ORDERS",
  "WAREHOUSE",
  "QR_LABELS",
  "EXTINGUISHERS",
  "CUSTOMERS",
  "CUSTOMER_PORTAL",
  "REPORTS_MONTHLY",
  "CUSTOMER_ANALYTICS",
  "EMAIL_NOTIFICATIONS",
  "SALES_ORDERS",
  "SALES_WAREHOUSE",
  "ADMIN_SERVICERS",
  "ADMIN_SETTINGS",
];

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-600
        ${checked ? "bg-emerald-500" : "bg-slate-300"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm
          ring-0 transition-transform duration-200 ease-in-out mt-0.5
          ${checked ? "translate-x-[22px]" : "translate-x-0.5"}
        `}
      />
    </button>
  );
}

export default function PlatformFeatureToggles({ companyId, features }: Props) {
  const [state, setState] = useState<Record<string, FeatureState>>({ ...features });
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(key: string, field: "enabledForAdmin" | "enabledForWorkshop", value: boolean) {
    const prev = state[key] ?? { enabledForAdmin: true, enabledForWorkshop: false };
    setState((s) => ({ ...s, [key]: { ...prev, [field]: value } }));
    setSaving(`${key}-${field}`);

    try {
      await fetch(`/api/platform/companies/${companyId}/features/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, field, value }),
      });
    } catch {
      setState((s) => ({ ...s, [key]: prev }));
    }
    setSaving(null);
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {KEY_ORDER.map((key) => {
        const meta = MODULE_META[key];
        if (!meta) return null;
        const feat = state[key] ?? { enabledForAdmin: true, enabledForWorkshop: false };

        return (
          <div
            key={key}
            className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="text-2xl leading-none mt-0.5">{meta.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-slate-900">{meta.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{meta.description}</div>
              <div className="flex items-center gap-5 mt-3">
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Toggle
                    checked={feat.enabledForAdmin}
                    onChange={(v) => handleToggle(key, "enabledForAdmin", v)}
                    disabled={saving === `${key}-enabledForAdmin`}
                  />
                  Admin
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700">
                  <Toggle
                    checked={feat.enabledForWorkshop}
                    onChange={(v) => handleToggle(key, "enabledForWorkshop", v)}
                    disabled={saving === `${key}-enabledForWorkshop`}
                  />
                  Workshop
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
