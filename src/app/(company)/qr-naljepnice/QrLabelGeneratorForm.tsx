"use client";

import { useMemo, useState } from "react";
import {
  LABEL_SHEET_PRESETS,
  LABEL_WEIGHTS,
  formatLabelCode,
  getLabelSheetPreset,
  pageCount,
  validateLabelRange,
} from "@/lib/labelSheets";

export default function QrLabelGeneratorForm({
  serviceCode,
  servicerName,
}: {
  serviceCode: string;
  servicerName: string;
}) {
  const [weight, setWeight] = useState<number>(6);
  const [from, setFrom] = useState<number>(1);
  const [to, setTo] = useState<number>(15);
  const [presetId, setPresetId] = useState<string>(LABEL_SHEET_PRESETS[0].id);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const preset = getLabelSheetPreset(presetId);
  const validation = validateLabelRange({ weight, from, to });
  const count = validation.ok ? validation.count : 0;
  const pages = validation.ok ? pageCount(count, preset) : 0;

  const firstCode = useMemo(() => formatLabelCode(serviceCode, weight, from), [serviceCode, weight, from]);
  const lastCode = useMemo(() => formatLabelCode(serviceCode, weight, to), [serviceCode, weight, to]);

  function buildUrl(mode: "labels" | "calibration"): string {
    const p = new URLSearchParams();
    p.set("mode", mode);
    p.set("preset", presetId);
    p.set("offsetX", String(offsetX));
    p.set("offsetY", String(offsetY));
    if (mode === "labels") {
      p.set("weight", String(weight));
      p.set("from", String(from));
      p.set("to", String(to));
    }
    return `/qr-naljepnice/pdf?${p.toString()}`;
  }

  function open(mode: "labels" | "calibration") {
    window.open(buildUrl(mode), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <section className="surface p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="weight">Težina / zapremina punjenja</label>
            <select
              id="weight"
              className="input"
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            >
              {LABEL_WEIGHTS.map((w) => (
                <option key={w} value={w}>{w} kg / L</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="from">Redni broj od</label>
            <input
              id="from"
              type="number"
              min={1}
              max={99999}
              className="input"
              value={from}
              onChange={(e) => setFrom(Math.trunc(Number(e.target.value)))}
            />
          </div>
          <div>
            <label className="label" htmlFor="to">Redni broj do</label>
            <input
              id="to"
              type="number"
              min={1}
              max={99999}
              className="input"
              value={to}
              onChange={(e) => setTo(Math.trunc(Number(e.target.value)))}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="preset">Raster naljepnica</label>
          <select id="preset" className="input" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            {LABEL_SHEET_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span>Naljepnica: <strong>{preset.labelWidth} × {preset.labelHeight} mm</strong></span>
            <span>Po arku: <strong>{preset.columns * preset.rows}</strong> ({preset.columns}×{preset.rows})</span>
            <span>Servis: <strong>{servicerName}</strong></span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-700">
            <span>Prvi kod: <strong className="font-mono">{firstCode}</strong></span>
            <span>Zadnji kod: <strong className="font-mono">{lastCode}</strong></span>
          </div>
          {validation.ok ? (
            <div className="mt-2 text-slate-600">
              Ukupno: <strong>{count}</strong> naljepnica · <strong>{pages}</strong> {pages === 1 ? "stranica" : "stranica"} (A4)
            </div>
          ) : (
            <div className="mt-2 font-medium text-red-700">{validation.error}</div>
          )}
        </div>

        <div>
          <button
            type="button"
            className="text-sm font-medium text-slate-600 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            {showAdvanced ? "Sakrij fini pomak" : "Fini pomak (kalibracija pisača)"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="offsetX">Pomak X (mm)</label>
                <input
                  id="offsetX"
                  type="number"
                  step={0.1}
                  min={-20}
                  max={20}
                  className="input"
                  value={offsetX}
                  onChange={(e) => setOffsetX(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label" htmlFor="offsetY">Pomak Y (mm)</label>
                <input
                  id="offsetY"
                  type="number"
                  step={0.1}
                  min={-20}
                  max={20}
                  className="input"
                  value={offsetY}
                  onChange={(e) => setOffsetY(Number(e.target.value))}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary px-4"
            disabled={!validation.ok}
            onClick={() => open("labels")}
          >
            Generiraj PDF
          </button>
          <button type="button" className="btn btn-outline px-4" onClick={() => open("calibration")}>
            Kalibracijski list
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">Važno za točan ispis</div>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>U dijalogu za ispis postavite <strong>Mjerilo: 100%</strong> / „Stvarna veličina” (ne „Prilagodi stranici”).</li>
          <li>Prvo ispišite <strong>kalibracijski list</strong> i ravnalom provjerite da referentne linije mjere točno 100 mm.</li>
          <li>Ako raster nije poravnat s arkom, korigirajte <strong>fini pomak X/Y</strong> i ponovite.</li>
        </ul>
      </section>
    </div>
  );
}
