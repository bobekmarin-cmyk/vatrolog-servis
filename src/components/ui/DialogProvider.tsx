"use client";

import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";
import Modal, { type ModalVariant } from "./Modal";

export type AlertOptions = {
  title?: string;
  message: ReactNode;
  variant?: ModalVariant;
  okLabel?: string;
};

export type ConfirmOptions = {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type DialogApi = {
  alert: (opts: AlertOptions) => Promise<void>;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

type AlertRequest = {
  kind: "alert";
  opts: AlertOptions;
  resolve: () => void;
};

type ConfirmRequest = {
  kind: "confirm";
  opts: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type Request = AlertRequest | ConfirmRequest;

export const DialogContext = createContext<DialogApi | null>(null);

export default function DialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Request[]>([]);

  const current = queue[0] ?? null;

  const closeCurrent = useCallback((result?: boolean) => {
    setQueue((q) => {
      const head = q[0];
      if (!head) return q;
      if (head.kind === "alert") head.resolve();
      else head.resolve(result === true);
      return q.slice(1);
    });
  }, []);

  const alertFn = useCallback((opts: AlertOptions): Promise<void> => {
    return new Promise<void>((resolve) => {
      setQueue((q) => [...q, { kind: "alert", opts, resolve }]);
    });
  }, []);

  const confirmFn = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setQueue((q) => [...q, { kind: "confirm", opts, resolve }]);
    });
  }, []);

  const api = useMemo<DialogApi>(
    () => ({ alert: alertFn, confirm: confirmFn }),
    [alertFn, confirmFn],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {current ? (
        current.kind === "alert" ? (
          <AlertModal req={current} onClose={() => closeCurrent()} />
        ) : (
          <ConfirmModal
            req={current}
            onCancel={() => closeCurrent(false)}
            onConfirm={() => closeCurrent(true)}
          />
        )
      ) : null}
    </DialogContext.Provider>
  );
}

function AlertModal({ req, onClose }: { req: AlertRequest; onClose: () => void }) {
  const variant: ModalVariant = req.opts.variant ?? "info";
  const title = req.opts.title ?? defaultAlertTitle(variant);
  const okLabel = req.opts.okLabel ?? "U redu";

  return (
    <Modal
      open
      title={title}
      variant={variant}
      onClose={onClose}
      footer={
        <button
          type="button"
          autoFocus
          className="rounded-md bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          onClick={onClose}
        >
          {okLabel}
        </button>
      }
    >
      <div>{req.opts.message}</div>
    </Modal>
  );
}

function ConfirmModal({
  req,
  onCancel,
  onConfirm,
}: {
  req: ConfirmRequest;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const danger = req.opts.danger === true;
  const variant: ModalVariant = danger ? "danger" : "neutral";
  const title = req.opts.title ?? (danger ? "Potvrda" : "Potvrda");
  const confirmLabel = req.opts.confirmLabel ?? "Potvrdi";
  const cancelLabel = req.opts.cancelLabel ?? "Odustani";

  const confirmClass = danger
    ? "rounded-md bg-rose-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
    : "rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700";

  return (
    <Modal
      open
      title={title}
      variant={variant}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button type="button" autoFocus className={confirmClass} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div>{req.opts.message}</div>
    </Modal>
  );
}

function defaultAlertTitle(variant: ModalVariant): string {
  switch (variant) {
    case "error":
    case "danger":
      return "Greška";
    case "warning":
      return "Upozorenje";
    case "success":
      return "Uspjeh";
    case "info":
    case "neutral":
    default:
      return "Obavijest";
  }
}
