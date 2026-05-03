"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";

type ScanStatus = "ok" | "skipped" | "error";

type ScanEntry = {
  id: number;
  internalCode: string;
  status: ScanStatus;
  title: string;
  subtitle?: string;
  at: string;
};

type PendingConfirm = {
  internalCode: string;
  ownerCustomerName: string | null;
  orderCustomerName: string | null;
};

function nowLabel(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function ScanExtinguisherModal({
  orderId,
  triggerLabel = "Skeniraj QR kod",
  triggerClassName = "btn btn-outline h-9",
}: {
  orderId: string;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<ScanEntry[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const nextId = useRef(1);

  const addEntry = useCallback((e: Omit<ScanEntry, "id" | "at">) => {
    setEntries((prev) => [
      { ...e, id: nextId.current++, at: nowLabel() },
      ...prev,
    ]);
  }, []);

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(focusInput, 40);
    return () => clearTimeout(t);
  }, [open, focusInput]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [flash]);

  const doScan = useCallback(
    async (code: string, force: boolean) => {
      const trimmed = code.trim();
      if (!trimmed) {
        focusInput();
        return;
      }
      setBusy(true);
      try {
        const res = await fetch(`/api/work-orders/${orderId}/items/scan-add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ internalCode: trimmed, force }),
        });

        if (res.ok) {
          const data = await res.json();
          const subtitleParts = [data.manufacturerName, data.typeName]
            .filter((x: unknown) => typeof x === "string" && x.length > 0)
            .join(" · ");
          addEntry({
            internalCode: data.internalCode ?? trimmed,
            status: "ok",
            title: data.internalCode ?? trimmed,
            subtitle: subtitleParts || undefined,
          });
          setFlash("ok");
          router.refresh();
          return;
        }

        let payload: {
          error?: string;
          reason?: string;
          internalCode?: string;
          ownerCustomerName?: string | null;
          orderCustomerName?: string | null;
        } = {};
        try {
          payload = await res.json();
        } catch {
          // ignoriraj
        }

        if (res.status === 409 && payload.reason === "customer_mismatch") {
          setPendingConfirm({
            internalCode: payload.internalCode ?? trimmed,
            ownerCustomerName: payload.ownerCustomerName ?? null,
            orderCustomerName: payload.orderCustomerName ?? null,
          });
          setFlash("err");
          return;
        }

        const reason = payload.reason ?? "";
        let title = payload.internalCode ?? trimmed;
        let subtitle = payload.error ?? "Greška kod skeniranja.";
        if (reason === "already_in_order") {
          subtitle = "Već je u ovom nalogu.";
        } else if (reason === "scrapped") {
          subtitle = "Aparat je rashodovan.";
        } else if (reason === "not_found") {
          subtitle = "Interni broj nije pronađen.";
        } else if (reason === "locked") {
          subtitle = "Nalog je zaključan.";
          title = trimmed;
        }

        addEntry({
          internalCode: title,
          status: "error",
          title,
          subtitle,
        });
        setFlash("err");
      } catch {
        addEntry({
          internalCode: trimmed,
          status: "error",
          title: trimmed,
          subtitle: "Greška mreže.",
        });
        setFlash("err");
      } finally {
        setBusy(false);
        setValue("");
        setTimeout(focusInput, 20);
      }
    },
    [orderId, router, addEntry, focusInput]
  );

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy || pendingConfirm) return;
    doScan(value, false);
  };

  const confirmMismatchYes = () => {
    if (!pendingConfirm) return;
    const code = pendingConfirm.internalCode;
    setPendingConfirm(null);
    doScan(code, true);
  };

  const confirmMismatchNo = () => {
    if (!pendingConfirm) return;
    addEntry({
      internalCode: pendingConfirm.internalCode,
      status: "skipped",
      title: pendingConfirm.internalCode,
      subtitle: `Preskočeno — aparat pripada kupcu ${pendingConfirm.ownerCustomerName ?? "(nepoznato)"}.`,
    });
    setPendingConfirm(null);
    setValue("");
    setTimeout(focusInput, 20);
  };

  const counts = {
    ok: entries.filter((e) => e.status === "ok").length,
    skipped: entries.filter((e) => e.status === "skipped").length,
    error: entries.filter((e) => e.status === "error").length,
  };

  const handleClose = () => {
    setOpen(false);
    setPendingConfirm(null);
    setValue("");
    setEntries([]);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className="mr-1">⎙</span>
        {triggerLabel}
      </button>

      <Modal
        open={open}
        title="Skeniranje QR kodova aparata"
        variant="info"
        size="lg"
        onClose={handleClose}
        closeOnBackdrop={false}
        closeOnEsc={true}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                Dodano: {counts.ok}
              </span>
              <span className="rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                Preskočeno: {counts.skipped}
              </span>
              <span className="rounded-md bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                Greške: {counts.error}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-primary h-9 px-4"
              onClick={handleClose}
            >
              Zatvori
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-600">
            Fokusiraj ovo polje i redom skeniraj QR kodove aparata. Svaki skener
            automatski utipka interni broj i pošalje Enter.
          </p>

          <form onSubmit={onSubmit}>
            <div
              className={
                "flex items-center gap-2 rounded-lg border-2 px-3 py-2 transition-colors " +
                (flash === "ok"
                  ? "border-emerald-500 bg-emerald-50"
                  : flash === "err"
                  ? "border-rose-500 bg-rose-50"
                  : "border-sky-300 bg-sky-50/50")
              }
            >
              <span aria-hidden className="text-lg">⌕</span>
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-base font-mono outline-none"
                placeholder="Skeniraj ili upiši interni broj…"
                value={value}
                autoFocus
                disabled={busy || !!pendingConfirm}
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => {
                  if (open && !pendingConfirm) setTimeout(focusInput, 100);
                }}
              />
              <button
                type="submit"
                className="btn btn-primary h-8 px-3 text-xs"
                disabled={busy || !!pendingConfirm || !value.trim()}
              >
                Dodaj
              </button>
            </div>
          </form>

          {pendingConfirm ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
              <div className="mb-2 font-semibold text-amber-900">
                Aparat pripada drugom kupcu
              </div>
              <div className="mb-3 text-amber-900">
                Interni broj{" "}
                <span className="font-mono font-semibold">
                  {pendingConfirm.internalCode}
                </span>{" "}
                zadnje je servisiran kod kupca{" "}
                <span className="font-semibold">
                  {pendingConfirm.ownerCustomerName ?? "(nepoznato)"}
                </span>
                , a ovaj nalog je za{" "}
                <span className="font-semibold">
                  {pendingConfirm.orderCustomerName ?? "(nepoznato)"}
                </span>
                . Želiš li ga svejedno dodati?
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline h-8 px-3 text-xs"
                  onClick={confirmMismatchNo}
                >
                  Ne, preskoči
                </button>
                <button
                  type="button"
                  className="btn btn-primary h-8 px-3 text-xs"
                  onClick={confirmMismatchYes}
                >
                  Da, dodaj svejedno
                </button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[320px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50">
            {entries.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                Skenirani aparati prikazivat će se ovdje.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-start gap-3 bg-white px-3 py-2"
                  >
                    <span
                      className={
                        "mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold " +
                        (e.status === "ok"
                          ? "bg-emerald-100 text-emerald-700"
                          : e.status === "skipped"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700")
                      }
                      aria-hidden
                    >
                      {e.status === "ok" ? "✓" : e.status === "skipped" ? "↷" : "!"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-800">
                          {e.title}
                        </span>
                        <span className="text-[10px] text-slate-400">{e.at}</span>
                      </div>
                      {e.subtitle ? (
                        <div
                          className={
                            "text-xs " +
                            (e.status === "ok"
                              ? "text-slate-600"
                              : e.status === "skipped"
                              ? "text-amber-700"
                              : "text-rose-700")
                          }
                        >
                          {e.subtitle}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
