"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "vatrolog_cookie_ack_v1";

export default function CookieBanner(): React.ReactElement | null {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const acked = window.localStorage.getItem(STORAGE_KEY);
      if (!acked) setVisible(true);
    } catch {
      // ignore
    }
  }, []);

  if (!visible) return null;

  const accept = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-4 pb-4 pointer-events-none">
      <div className="mx-auto max-w-4xl pointer-events-auto rounded-xl border border-slate-200 bg-white shadow-xl p-4 flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="flex-1 text-sm text-slate-700">
          <strong>Kolačići:</strong> Koristimo isključivo nužne kolačiće za autentifikaciju i sigurnost (sesija, CSRF).
          Ne koristimo marketinške kolačiće. Više u{" "}
          <Link href="/legal/privacy" className="text-red-600 hover:underline">Politici privatnosti</Link>.
        </div>
        <button
          type="button"
          onClick={accept}
          className="rounded-lg bg-slate-900 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-800"
        >
          U redu, razumijem
        </button>
      </div>
    </div>
  );
}
