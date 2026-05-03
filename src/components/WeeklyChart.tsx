"use client";

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

type DayData = {
  label: string;
  count: number;
  isToday: boolean;
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

export default function WeeklyChart({ data }: { data: DayData[] }) {
  const tooltipFormatter = (value: ValueType | undefined): [string, string] => [
    `${typeof value === "number" ? value : Number(value ?? 0)} aparata`,
    "Servisirano",
  ];
  const labelFormatter = (label: unknown): string => String(label ?? "").replace("\n", " ");

  return (
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
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.isToday ? "#10b981" : "#6366f1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
