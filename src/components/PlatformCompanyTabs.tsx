"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  children: ReactNode[];
};

export default function PlatformCompanyTabs({ tabs, children }: Props) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");

  return (
    <div>
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`
              px-4 py-2.5 text-sm font-medium -mb-px transition-colors
              ${active === t.id
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700"
              }
            `}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabs.map((t, i) => (
        <div key={t.id} className={active === t.id ? "" : "hidden"}>
          {children[i]}
        </div>
      ))}
    </div>
  );
}
