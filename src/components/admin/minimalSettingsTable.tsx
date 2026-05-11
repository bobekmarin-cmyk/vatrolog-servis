"use client";

import type { ReactNode } from "react";

/** Zajednički minimalistički tablica kao u Postavke → Rezervni dijelovi. */
export const MIN_TABLE_TH = "px-3 py-2 align-middle";
export const MIN_TABLE_TD = "px-3 py-2.5 align-middle";

export function MinimalTableShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "overflow-x-auto rounded-lg border border-slate-200 bg-white " + className
      }
    >
      {children}
    </div>
  );
}

export function MinimalSearchInput({
  value,
  onChange,
  placeholder,
  endSlot,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  endSlot?: ReactNode;
}) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-2">
      <input
        type="search"
        className="h-9 min-w-[12rem] max-w-md flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-200"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {endSlot}
    </div>
  );
}

export function MinimalRowAction({
  children,
  onClick,
  disabled,
  primary,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const color = danger
    ? "text-rose-700 hover:text-rose-900"
    : primary
      ? "font-medium text-slate-900 hover:text-black"
      : "text-slate-600 hover:text-slate-900";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "text-xs underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline " +
        color
      }
    >
      {children}
    </button>
  );
}

export function MinimalStatusDot({
  kind,
  label,
}: {
  kind: "ok" | "off" | "muted";
  label: string;
}) {
  const dot =
    kind === "ok" ? "bg-emerald-500" : kind === "off" ? "bg-slate-300" : "bg-slate-400";
  const text =
    kind === "ok" ? "text-emerald-700" : "text-slate-500";
  return (
    <span className={"inline-flex items-center gap-1.5 text-xs font-medium " + text}>
      <span className={"inline-block h-1.5 w-1.5 rounded-full " + dot} aria-hidden />
      {label}
    </span>
  );
}
