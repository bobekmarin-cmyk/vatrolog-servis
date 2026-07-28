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
import AddExtinguisherForm from "@/components/AddExtinguisherForm";
import EditExtinguisherForm from "@/components/EditExtinguisherForm";

export type ExtinguisherDrawerMode = "fill" | "edit";

type Manufacturer = {
  id: string;
  name: string;
  supportedTypes?: { extinguisherTypeId: string }[];
};

type ExtinguisherType = {
  id: string;
  name: string;
  code: string;
  agent?: { code: string; label: string; symbol?: string | null } | null;
  construction?: { code: string; label: string } | null;
};

type FormData = {
  mode: ExtinguisherDrawerMode;
  manufacturers: Manufacturer[];
  types: ExtinguisherType[];
  initial: {
    internalCode: string;
    manufacturerId: string;
    extinguisherTypeId: string;
    serialNumber: string;
    productionYear: number;
    typeDescription: string | null;
    serviceLocationText: string | null;
  } | null;
};

type Ctx = {
  openDrawer: (itemId: string, mode: ExtinguisherDrawerMode) => void;
  highlightItemId: string | null;
};

const DrawerCtx = createContext<Ctx | null>(null);

const FORM_ID = "wo-extinguisher-drawer-form";
const HIGHLIGHT_MS = 2000;

function useDrawerCtx(): Ctx {
  const ctx = useContext(DrawerCtx);
  if (!ctx) {
    throw new Error("Komponenta mora biti unutar <WorkOrderExtinguisherDrawerProvider>.");
  }
  return ctx;
}

function syncUrl(itemId: string | null, mode: ExtinguisherDrawerMode | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (itemId && mode) {
    url.searchParams.set("item", itemId);
    url.searchParams.set("mode", mode);
  } else {
    url.searchParams.delete("item");
    url.searchParams.delete("mode");
  }
  window.history.replaceState(window.history.state, "", url.toString());
}

export function WorkOrderExtinguisherDrawerProvider({
  orderId,
  orderNumber,
  customerName,
  locked,
  initialItemId,
  initialMode,
  children,
}: {
  orderId: string;
  orderNumber: string;
  customerName: string;
  locked: boolean;
  initialItemId?: string;
  initialMode?: ExtinguisherDrawerMode;
  children: ReactNode;
}) {
  const router = useRouter();

  const [itemId, setItemId] = useState<string | null>(
    !locked && initialItemId ? initialItemId : null,
  );
  const [open, setOpen] = useState<boolean>(!locked && !!initialItemId);
  const [mode, setMode] = useState<ExtinguisherDrawerMode>(initialMode ?? "fill");

  const [data, setData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [canSubmit, setCanSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  const focusRef = useRef<HTMLElement | null>(null);

  const openDrawer = useCallback(
    (nextItemId: string, nextMode: ExtinguisherDrawerMode) => {
      if (locked) return;
      setItemId(nextItemId);
      setMode(nextMode);
      setOpen(true);
      syncUrl(nextItemId, nextMode);
    },
    [locked],
  );

  const closeDrawer = useCallback(() => {
    if (submitting) return;
    setOpen(false);
    syncUrl(null, null);
  }, [submitting]);

  // Dohvat podataka forme tek kad se drawer otvori — stranica naloga ih ne nosi.
  useEffect(() => {
    if (!open || !itemId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setLoadError(null);
      setData(null);
      setCanSubmit(false);
    });

    fetch(`/api/work-orders/${orderId}/items/${itemId}/extinguisher-form`, {
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !payload?.ok) {
          setLoadError(payload?.error ?? "Podatke nije moguće učitati.");
          return;
        }
        setMode(payload.mode as ExtinguisherDrawerMode);
        setData({
          mode: payload.mode,
          manufacturers: payload.manufacturers ?? [],
          types: payload.types ?? [],
          initial: payload.initial ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Greška mreže — podaci nisu učitani.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, itemId, orderId]);

  // Forma se renderira tek nakon dohvata, pa fokus namještamo kad podaci stignu.
  useEffect(() => {
    if (!open || !data) return;
    const timer = setTimeout(() => {
      const el = focusRef.current;
      if (!el) return;
      el.focus();
      if (el instanceof HTMLInputElement) el.select();
    }, 30);
    return () => clearTimeout(timer);
  }, [open, data]);

  useEffect(() => {
    if (!highlightItemId) return;
    const timer = setTimeout(() => setHighlightItemId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightItemId]);

  const handleSuccess = useCallback(() => {
    setHighlightItemId(itemId);
    setOpen(false);
    syncUrl(null, null);
    router.refresh();
  }, [itemId, router]);

  const handleCanSubmitChange = useCallback((value: boolean) => setCanSubmit(value), []);
  const handleSubmittingChange = useCallback((value: boolean) => setSubmitting(value), []);

  const title = mode === "fill" ? "Popuni podatke aparata" : "Uredi podatke aparata";

  return (
    <DrawerCtx.Provider value={{ openDrawer, highlightItemId }}>
      {children}

      <Drawer
        open={open}
        onClose={closeDrawer}
        title={title}
        subtitle={`Nalog ${orderNumber} — ${customerName}`}
        width="min(560px, 100vw)"
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
                canSubmit ? "btn-primary" : "cursor-not-allowed bg-slate-200 text-slate-500",
              ].join(" ")}
              disabled={!canSubmit || submitting || loading || !data}
            >
              {submitting ? "Spremam…" : mode === "fill" ? "Spremi" : "Spremi promjene"}
            </button>
          </div>
        }
      >
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-full animate-pulse rounded-xl bg-slate-100" />
            <div className="h-9 w-2/3 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {loadError}
          </div>
        ) : data && itemId ? (
          data.mode === "edit" && data.initial ? (
            <EditExtinguisherForm
              key={`edit-${itemId}`}
              orderId={orderId}
              itemId={itemId}
              manufacturers={data.manufacturers}
              types={data.types}
              initial={data.initial}
              embedded
              formId={FORM_ID}
              focusRef={focusRef}
              onSuccess={handleSuccess}
              onCancel={closeDrawer}
              onCanSubmitChange={handleCanSubmitChange}
              onSubmittingChange={handleSubmittingChange}
            />
          ) : (
            <AddExtinguisherForm
              key={`fill-${itemId}`}
              orderId={orderId}
              itemId={itemId}
              manufacturers={data.manufacturers}
              types={data.types}
              embedded
              formId={FORM_ID}
              focusRef={focusRef}
              onSuccess={handleSuccess}
              onCancel={closeDrawer}
              onCanSubmitChange={handleCanSubmitChange}
              onSubmittingChange={handleSubmittingChange}
            />
          )
        ) : null}
      </Drawer>
    </DrawerCtx.Provider>
  );
}

export function WorkOrderExtinguisherDrawerButton({
  itemId,
  mode,
}: {
  itemId: string;
  mode: ExtinguisherDrawerMode;
}) {
  const { openDrawer } = useDrawerCtx();
  const label = mode === "fill" ? "Popuni" : "Uredi podatke aparata";

  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50"
      onClick={() => openDrawer(itemId, mode)}
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
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );
}

export function WorkOrderItemRow({
  itemId,
  children,
}: {
  itemId: string;
  children: ReactNode;
}) {
  const { highlightItemId } = useDrawerCtx();
  const highlighted = highlightItemId === itemId;

  return (
    <tr
      className={[
        "transition-colors duration-500",
        highlighted
          ? "bg-emerald-50 ring-2 ring-inset ring-emerald-300"
          : "hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </tr>
  );
}
