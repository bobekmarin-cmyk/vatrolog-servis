"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Prikazuje trenutni datum i vrijeme. Inicijalno SSR/prvi render daje prazan
 * placeholder kako bi se izbjegao React hydration mismatch (#418): server je
 * u UTC-u, klijent u CET, pa bi se isti `new Date()` stringificirao različito
 * između render passova. Vrijeme se popuni tek u `useEffect` na klijentu i
 * osvježava svakih 10 sekundi.
 */
export default function NowDateTime(props: { className?: string }) {
  const { className } = props;
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    queueMicrotask(() => setNow(new Date()));
    const t = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const text = useMemo(() => {
    if (!now) return "";
    try {
      return new Intl.DateTimeFormat("hr-HR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(now);
    } catch {
      return now.toLocaleString();
    }
  }, [now]);

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
