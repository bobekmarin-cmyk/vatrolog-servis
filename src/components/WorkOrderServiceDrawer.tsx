"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import ServiceDrawerForm from "@/components/ServiceDrawerForm";
import { useContentDrawerPresence } from "@/components/ShellLayoutContext";
import { useWorkOrderRowHighlight } from "@/components/WorkOrderRowHighlight";
import { syncWorkOrderDrawerUrl } from "@/lib/workOrderDrawerUrl";
import type { ServiceFormPayload } from "@/lib/serviceFormData";

const FORM_ID = "wo-service-drawer-form";

type LoadResult =
  | { data: ServiceFormPayload; error: null }
  | { data: null; error: string };

type Ctx = {
  openService: (itemId: string) => void;
  prefetchService: (itemId: string) => void;
};

const ServiceDrawerCtx = createContext<Ctx | null>(null);

const NOOP_PREFETCH = () => {};

function useServiceDrawerCtx(): Ctx {
  const ctx = useContext(ServiceDrawerCtx);
  if (!ctx) {
    throw new Error("Komponenta mora biti unutar <WorkOrderServiceDrawerProvider>.");
  }
  return ctx;
}

/**
 * Zagrijavanje podataka servisne forme izvan drawera (npr. kad se zatvori
 * drawer aparata). Vraća no-op ako provider nije prisutan.
 */
export function useWorkOrderServicePrefetch(): (itemId: string) => void {
  const ctx = useContext(ServiceDrawerCtx);
  return ctx?.prefetchService ?? NOOP_PREFETCH;
}

export function WorkOrderServiceDrawerProvider({
  orderId,
  orderNumber,
  customerName,
  locked,
  initialItemId,
  /** Stavke koje se zagrijavaju u pozadini nakon učitavanja stranice. */
  idlePrefetchItemIds = [],
  children,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  locked: boolean;
  initialItemId?: string;
  idlePrefetchItemIds?: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { highlightItem } = useWorkOrderRowHighlight();

  const [itemId, setItemId] = useState<string | null>(
    !locked && initialItemId ? initialItemId : null,
  );
  const [open, setOpen] = useState<boolean>(!locked && !!initialItemId);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [loading, setLoading] = useState<boolean>(!locked && !!initialItemId);
  const [submitting, setSubmitting] = useState(false);
  const [scrapMode, setScrapMode] = useState(false);

  const cacheRef = useRef<Map<string, LoadResult>>(new Map());
  const inflightRef = useRef<Map<string, Promise<LoadResult>>>(new Map());
  const currentItemIdRef = useRef<string | null>(itemId);
  const focusRef = useRef<HTMLInputElement | null>(null);
  // Epoha po stavki: spremanje obezvrijedi samo tu stavku (i njezine odgovore
  // u letu), dok ostale stavke ostaju zagrijane u kešu.
  const epochByItemRef = useRef<Map<string, number>>(new Map());

  useContentDrawerPresence(open);

  const invalidateItem = useCallback((targetItemId: string) => {
    const epochs = epochByItemRef.current;
    epochs.set(targetItemId, (epochs.get(targetItemId) ?? 0) + 1);
    cacheRef.current.delete(targetItemId);
    inflightRef.current.delete(targetItemId);
  }, []);

  const fetchForm = useCallback(
    (targetItemId: string): Promise<LoadResult> => {
      const cached = cacheRef.current.get(targetItemId);
      if (cached && !cached.error) return Promise.resolve(cached);

      const inflight = inflightRef.current.get(targetItemId);
      if (inflight) return inflight;

      const epoch = epochByItemRef.current.get(targetItemId) ?? 0;
      const request = (async (): Promise<LoadResult> => {
        try {
          const res = await fetch(
            `/api/work-orders/${orderId}/items/${targetItemId}/service-form`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => null)) as
            | { ok?: boolean; data?: ServiceFormPayload; error?: string }
            | null;
          if (!res.ok || !json?.ok || !json.data) {
            return {
              data: null,
              error: json?.error ?? "Podaci za servis nisu dostupni.",
            };
          }
          return { data: json.data, error: null };
        } catch {
          return { data: null, error: "Mrežna greška pri dohvaćanju podataka servisa." };
        }
      })();

      inflightRef.current.set(targetItemId, request);
      void request.then((value) => {
        if ((epochByItemRef.current.get(targetItemId) ?? 0) !== epoch) return;
        cacheRef.current.set(targetItemId, value);
        if (inflightRef.current.get(targetItemId) === request) {
          inflightRef.current.delete(targetItemId);
        }
      });
      return request;
    },
    [orderId],
  );

  const prefetchService = useCallback(
    (targetItemId: string) => {
      if (locked || !targetItemId) return;
      void fetchForm(targetItemId);
    },
    [locked, fetchForm],
  );

  const openService = useCallback(
    (targetItemId: string) => {
      if (locked) return;
      currentItemIdRef.current = targetItemId;
      setItemId(targetItemId);
      setScrapMode(false);
      setSubmitting(false);
      setOpen(true);
      syncWorkOrderDrawerUrl(targetItemId, "service");

      const cached = cacheRef.current.get(targetItemId);
      if (cached && !cached.error) {
        setResult(cached);
        setLoading(false);
        return;
      }
      setResult(null);
      setLoading(true);
      void fetchForm(targetItemId).then((value) => {
        if (currentItemIdRef.current !== targetItemId) return;
        setResult(value);
        setLoading(false);
      });
    },
    [locked, fetchForm],
  );

  // Otvaranje iz URL-a (?item=…&mode=service) i pozadinsko zagrijavanje.
  useEffect(() => {
    if (locked || !initialItemId) return;
    currentItemIdRef.current = initialItemId;
    void fetchForm(initialItemId).then((value) => {
      if (currentItemIdRef.current !== initialItemId) return;
      setResult(value);
      setLoading(false);
    });
  }, [locked, initialItemId, fetchForm]);

  useEffect(() => {
    if (locked || idlePrefetchItemIds.length === 0) return;
    const targets = idlePrefetchItemIds.slice(0, 1);
    const run = () => targets.forEach((id) => void fetchForm(id));

    const idle = typeof window !== "undefined" ? window.requestIdleCallback : undefined;
    if (idle) {
      const handle = idle(run, { timeout: 3000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = setTimeout(run, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, fetchForm, idlePrefetchItemIds.join(",")]);

  const closeDrawer = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    currentItemIdRef.current = null;
    syncWorkOrderDrawerUrl(null, null);
  }, [submitting]);

  const handleSuccess = useCallback(() => {
    highlightItem(itemId);
    if (itemId) invalidateItem(itemId);
    setSubmitting(false);
    setOpen(false);
    currentItemIdRef.current = null;
    // `replace` (a ne samo history API) jer bi refresh vratio ?item=&mode= u adresu.
    router.replace(window.location.pathname, { scroll: false });
    router.refresh();
  }, [itemId, router, highlightItem, invalidateItem]);

  const data = result?.data ?? null;
  const errorText = result?.error ?? null;

  const submitLabel = submitting
    ? scrapMode
      ? "Rashodujem…"
      : "Spremam…"
    : scrapMode
      ? "Rashoduj aparat"
      : "Spremi servis";

  return (
    <ServiceDrawerCtx.Provider value={{ openService, prefetchService }}>
      {children}

      <Drawer
        open={open}
        onClose={closeDrawer}
        title="Servisiraj aparat"
        subtitle={`Nalog ${orderNumber} — ${customerName}`}
        width="min(960px, 100vw)"
        closeOnBackdrop={!submitting}
        closeOnEsc={!submitting}
        initialFocusRef={focusRef}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-outline px-4"
              onClick={closeDrawer}
              disabled={submitting}
            >
              Odustani
            </button>
            <button
              type="submit"
              form={FORM_ID}
              className={[
                "btn px-5",
                !data || submitting
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : scrapMode
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "btn-primary",
              ].join(" ")}
              disabled={!data || submitting}
            >
              {submitLabel}
            </button>
          </div>
        }
      >
        {loading && !data ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : errorText ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {errorText}
          </div>
        ) : data ? (
          <ServiceDrawerForm
            key={data.itemId}
            data={data}
            formId={FORM_ID}
            focusRef={focusRef}
            onSuccess={handleSuccess}
            onCancel={closeDrawer}
            onSubmittingChange={setSubmitting}
            onScrapModeChange={setScrapMode}
          />
        ) : null}
      </Drawer>
    </ServiceDrawerCtx.Provider>
  );
}

export function WorkOrderServiceDrawerButton({
  itemId,
  serviced,
}: {
  itemId: string;
  serviced: boolean;
}) {
  const { openService, prefetchService } = useServiceDrawerCtx();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const label = serviced ? "Otvori servis" : "Servisiraj";
  const warm = () => prefetchService(itemId);

  return (
    <>
      <button
        type="button"
        className={[
          "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200",
          serviced ? "text-gray-700 hover:bg-gray-50" : "text-green-700 hover:bg-green-50",
        ].join(" ")}
        onClick={() => (serviced ? setConfirmOpen(true) : openService(itemId))}
        onMouseEnter={warm}
        onFocus={warm}
        title={label}
        aria-label={label}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L3 18l3 3 6.1-6.1a4 4 0 0 0 5.6-5.6l-2.2 2.2-2.8-2.8 2.0-2.5z" />
        </svg>
      </button>

      <Modal
        open={confirmOpen}
        title="Potvrda"
        variant="danger"
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => setConfirmOpen(false)}
            >
              Odustani
            </button>
            <button
              type="button"
              autoFocus
              className="rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
              onClick={() => {
                setConfirmOpen(false);
                openService(itemId);
              }}
            >
              Otvori servis
            </button>
          </>
        }
      >
        <div>Aparat je već servisiran. Želiš li otvoriti servisni unos?</div>
      </Modal>
    </>
  );
}
