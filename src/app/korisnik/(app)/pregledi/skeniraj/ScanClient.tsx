"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Match = {
  extinguisherId: string;
  companyId: string;
  internalCode: string;
  serialNumber: string;
  typeCode: string | null;
  manufacturerName: string;
  servicerName: string;
};

/** Izvuci internu oznaku iz QR sadržaja (podržava i puni URL i čisti kod). */
function extractCode(raw: string): string {
  const text = raw.trim();
  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get("code") ?? url.searchParams.get("kod");
    if (fromQuery) return fromQuery.trim();
    const seg = url.pathname.split("/").filter(Boolean).pop();
    if (seg) return decodeURIComponent(seg).trim();
  } catch {
    // nije URL — koristi sirovi tekst
  }
  return text;
}

export default function ScanClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [scanning, setScanning] = useState(false);
  const [supported, setSupported] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "BarcodeDetector" in window);
  }, []);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  const lookup = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    setNotFound(false);
    setMatches(null);
    try {
      const res = await fetch(`/api/portal/extinguishers/resolve?code=${encodeURIComponent(trimmed)}`);
      const data = (await res.json().catch(() => ({}))) as { matches?: Match[] };
      if (!res.ok) {
        setError("Greška pri dohvaćanju aparata.");
        return;
      }
      const list = data.matches ?? [];
      if (list.length === 0) {
        setNotFound(true);
      } else {
        setMatches(list);
      }
    } catch {
      setError("Greška u komunikaciji s poslužiteljem.");
    } finally {
      setBusy(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setNotFound(false);
    setMatches(null);
    if (!("BarcodeDetector" in window)) {
      setError("Vaš preglednik ne podržava skeniranje. Unesite oznaku ručno.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });

      const tick = async () => {
        if (!videoRef.current || !streamRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes && codes.length > 0) {
            const value = String(codes[0].rawValue ?? "");
            if (value) {
              stopCamera();
              await lookup(extractCode(value));
              return;
            }
          }
        } catch {
          // ignoriraj pojedinačne greške detekcije
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Kamera nije dostupna. Provjerite dozvole ili unesite oznaku ručno.");
      stopCamera();
    }
  }, [lookup, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Skeniraj QR kod</h2>
        <p className="mt-1 text-sm text-slate-600">
          Usmjerite kameru na QR naljepnicu aparata. Ako skeniranje nije dostupno, unesite oznaku ručno ispod.
        </p>

        <div className="mt-3 overflow-hidden rounded-lg bg-slate-900">
          <video
            ref={videoRef}
            playsInline
            muted
            className={scanning ? "h-64 w-full object-cover" : "hidden"}
          />
          {!scanning ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-300">
              Kamera je isključena
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {!scanning ? (
            <button type="button" onClick={startCamera} disabled={!supported} className="btn btn-primary h-9">
              Uključi kameru
            </button>
          ) : (
            <button type="button" onClick={stopCamera} className="btn btn-outline h-9">
              Zaustavi
            </button>
          )}
        </div>
        {!supported ? (
          <p className="mt-2 text-xs text-amber-700">
            Skeniranje kamerom nije podržano u ovom pregledniku — koristite ručni unos.
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Ručni unos oznake</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(manual);
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            type="text"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="npr. 001234"
            className="input h-9 flex-1 min-w-[160px]"
          />
          <button type="submit" disabled={busy} className="btn btn-primary h-9">
            {busy ? "Tražim…" : "Pronađi"}
          </button>
        </form>
      </section>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {notFound ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Aparat s tom oznakom nije pronađen među vašim aparatima.
        </div>
      ) : null}

      {matches && matches.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header className="border-b border-slate-200 p-4">
            <h2 className="text-base font-semibold text-slate-900">
              {matches.length > 1 ? "Pronađeno više aparata — odaberite" : "Pronađeni aparat"}
            </h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {matches.map((m) => (
              <li key={`${m.companyId}-${m.extinguisherId}`} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold text-slate-900">{m.internalCode}</div>
                  <div className="text-sm text-slate-600">
                    {m.typeCode ?? "—"} · {m.manufacturerName} · serijski {m.serialNumber}
                  </div>
                  <div className="text-xs text-slate-500">Servis: {m.servicerName}</div>
                </div>
                <Link
                  href={`/korisnik/pregledi/novi?ext=${encodeURIComponent(m.extinguisherId)}&company=${encodeURIComponent(m.companyId)}`}
                  className="btn btn-primary h-9"
                >
                  Unesi pregled
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
