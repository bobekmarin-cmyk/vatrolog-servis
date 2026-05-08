"use client";

import { useState } from "react";
import type { BillingPlanId } from "@/lib/billing";
import { useToast } from "@/components/ui/ToastProvider";

export default function BillingActions({
  plan,
  stripeEnabled,
  hasSubscription,
}: {
  plan: BillingPlanId;
  stripeEnabled: boolean;
  hasSubscription: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function startCheckout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? "Greška.");
        showToast(data.error ?? "Greška pri pokretanju naplate.", "error");
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
      showToast("Greška u komunikaciji s poslužiteljem.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else {
        setError(data.error ?? "Greška.");
        showToast(data.error ?? "Greška pri otvaranju portala za naplatu.", "error");
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
      showToast("Greška u komunikaciji s poslužiteljem.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (!stripeEnabled) {
    return (
      <a
        href="mailto:marin@vatrolog.com?subject=VatroLog pretplata"
        className="block text-center w-full rounded-md bg-red-600 text-white py-2 font-medium hover:bg-red-700"
      >
        Aktiviraj
      </a>
    );
  }

  if (hasSubscription) {
    return (
      <div className="space-y-2">
        <button
          onClick={openPortal}
          disabled={loading}
          className="w-full rounded-md border border-slate-300 py-2 font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "..." : "Upravljanje pretplatom"}
        </button>
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={startCheckout}
        disabled={loading}
        className="w-full rounded-md bg-red-600 text-white py-2 font-medium hover:bg-red-700 disabled:opacity-50"
      >
        {loading ? "..." : "Pretplati se"}
      </button>
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
