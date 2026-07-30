"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTimeHr } from "@/lib/dateFormat";

type Run = {
  id: number;
  status: string | null;
  conclusion: string | null;
  createdAt: string;
  url: string;
  event: string;
};

function runLabel(r: Run): { text: string; className: string } {
  if (r.status !== "completed") {
    return { text: "u tijeku…", className: "text-sky-700" };
  }
  if (r.conclusion === "success") return { text: "uspješno", className: "text-emerald-700" };
  if (r.conclusion === "cancelled") return { text: "otkazano", className: "text-slate-500" };
  return { text: r.conclusion ?? "greška", className: "text-rose-700" };
}

function formatWhen(iso: string): string {
  return formatDateTimeHr(new Date(iso));
}

export default function BackupRunButton() {
  const router = useRouter();
  const [runs, setRuns] = useState<Run[]>([]);
  const [configured, setConfigured] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/backup/run");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRuns(data.runs ?? []);
        setConfigured(data.configured !== false);
        if (data.configured === false) setNotice(data.message ?? null);
      }
    } catch {
      // tiho — status nije kritican
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const inProgress = runs.some((r) => r.status !== "completed");

  // Dok backup traje, osvježavamo status svakih 8 s i stanemo kad završi.
  useEffect(() => {
    if (!inProgress) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => void load(), 8000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [inProgress, load]);

  // Kad zadnji run zavrsi uspjesno, osvjezi stranicu da se novi backup pojavi u tablici.
  const lastCompletedRef = useRef<number | null>(null);
  useEffect(() => {
    const newest = runs[0];
    if (!newest || newest.status !== "completed") return;
    if (lastCompletedRef.current === null) {
      lastCompletedRef.current = newest.id;
      return;
    }
    if (lastCompletedRef.current !== newest.id) {
      lastCompletedRef.current = newest.id;
      if (newest.conclusion === "success") router.refresh();
    }
  }, [runs, router]);

  async function startBackup() {
    if (starting || inProgress) return;
    setStarting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/platform/backup/run", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Pokretanje nije uspjelo.");
        return;
      }
      setNotice(data.message ?? "Backup je pokrenut.");
      setRuns(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pokretanje nije uspjelo.");
    } finally {
      setStarting(false);
    }
  }

  const latest = runs[0];

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Ručni backup baze</div>
          <p className="mt-0.5 text-xs text-slate-500">
            Pokreće isti workflow kao noćni backup: pg_dump → enkripcija → upload na R2.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary px-4 text-sm"
          onClick={startBackup}
          disabled={starting || inProgress || !configured}
          title={
            !configured
              ? "Nedostaje GITHUB_BACKUP_TOKEN"
              : inProgress
                ? "Backup je već u tijeku"
                : "Pokreni backup sada"
          }
        >
          {starting ? "Pokrećem…" : inProgress ? "Backup u tijeku…" : "Pokreni backup sada"}
        </button>
      </div>

      {notice ? (
        <div className="mt-3 rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
          {error}
        </div>
      ) : null}

      {latest ? (
        <div className="mt-3 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Zadnja pokretanja
          </div>
          {runs.slice(0, 3).map((r) => {
            const l = runLabel(r);
            return (
              <div key={r.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">
                  {formatWhen(r.createdAt)}
                  <span className="ml-2 text-slate-400">
                    {r.event === "workflow_dispatch" ? "ručno" : "automatski"}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`font-medium ${l.className}`}>{l.text}</span>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 hover:underline"
                  >
                    log
                  </a>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
