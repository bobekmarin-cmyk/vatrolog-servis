"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";

export type DayData = {
  label: string;
  count: number;
  isToday: boolean;
};

export type WeekData = {
  label: string;
  count: number;
  isCurrent: boolean;
};

function MultiLineTick({ x, y, payload }: { x: number; y: number; payload: { value: string } }) {
  const lines = payload.value.split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fontSize={11} fill="#64748b">
        <tspan x={0} dy={12} fontWeight={600}>{lines[0]}</tspan>
        <tspan x={0} dy={14} fontWeight={400} fill="#94a3b8">{lines[1]}</tspan>
      </text>
    </g>
  );
}

type Mode = "day" | "week";

export default function WeeklyChart({
  daily,
  weekly,
}: {
  daily: DayData[];
  weekly: WeekData[];
}) {
  const [mode, setMode] = useState<Mode>("day");

  const tooltipFormatter = (value: ValueType | undefined): [string, string] => [
    `${typeof value === "number" ? value : Number(value ?? 0)} aparata`,
    "Servisirano",
  ];
  const labelFormatter = (label: unknown): string => String(label ?? "").replace("\n", " ");

  const data: { label: string; count: number }[] = useMemo(() => {
    const src = mode === "day" ? daily : weekly;
    return src.map((d) => ({ label: d.label, count: d.count }));
  }, [mode, daily, weekly]);
  const isEmpty = data.length === 0 || data.every((d) => d.count === 0);

  const cellFills = useMemo(() => {
    if (mode === "day") {
      return daily.map((d) => (d.isToday ? "#10b981" : "#6366f1"));
    }
    return weekly.map((d) => (d.isCurrent ? "#10b981" : "#6366f1"));
  }, [mode, daily, weekly]);

  return (
    <div className="space-y-2">
      <div
        className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium"
        role="tablist"
        aria-label="Granularnost"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "day"}
          onClick={() => setMode("day")}
          className={[
            "rounded-md px-3 py-1 transition-colors",
            mode === "day"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800",
          ].join(" ")}
        >
          Po danu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "week"}
          onClick={() => setMode("week")}
          className={[
            "rounded-md px-3 py-1 transition-colors",
            mode === "week"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-800",
          ].join(" ")}
        >
          Po tjednu
        </button>
      </div>

      {isEmpty ? (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
          {mode === "day"
            ? "Još nema servisiranih aparata u zadnjih nekoliko dana."
            : "Još nema servisiranih aparata u prethodnim tjednima."}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={(props) => <MultiLineTick {...(props as { x: number; y: number; payload: { value: string } })} />}
              interval={0}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 13, border: "1px solid #e2e8f0" }}
              formatter={tooltipFormatter as (value: ValueType | undefined, name: NameType | undefined) => [string, string]}
              labelFormatter={labelFormatter}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((_, idx) => (
                <Cell key={idx} fill={cellFills[idx]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <div className="flex items-center gap-3 text-[10px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" />
          {mode === "day" ? "Prethodni dani" : "Prethodni tjedni"}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />
          {mode === "day" ? "Danas" : "Ovaj tjedan"}
        </span>
      </div>
    </div>
  );
}
