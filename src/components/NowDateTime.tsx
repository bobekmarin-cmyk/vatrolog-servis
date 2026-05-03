"use client";

import { useEffect, useMemo, useState } from "react";

export default function NowDateTime(props: { className?: string }) {
  const { className } = props;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(t);
  }, []);

  const text = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("hr-HR", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(now);
    } catch {
      return now.toLocaleString();
    }
  }, [now]);

  return <span className={className}>{text}</span>;
}

