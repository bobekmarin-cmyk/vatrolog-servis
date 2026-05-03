"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = string;

type Props = {
  requestId: string;
  status: Status;
  contactEmail: string;
  vendorInbox: string | null;
  companyId: string | null;
  adminAccountId: string | null;
  adminAccountEmail: string | null;
};

type Toast = { tone: "ok" | "err"; text: string } | null;

export default function ResendActions(props: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const isPending = props.status === "PENDING" || props.status === "REJECTED";
  const isConverted =
    (props.status === "APPROVED" || props.status === "CONVERTED") &&
    !!props.companyId &&
    !!props.adminAccountId;

  async function call(buttonId: string, fetchInit: () => Promise<Response>, okText: string) {
    setBusyId(buttonId);
    setToast(null);
    try {
      const res = await fetchInit();
      const data = await res.json().catch(() => ({} as { error?: string }));
      if (!res.ok) {
        setToast({
          tone: "err",
          text: data.error ?? `Slanje nije uspjelo (${res.status}).`,
        });
        return;
      }
      setToast({ tone: "ok", text: okText });
      router.refresh();
    } catch {
      setToast({ tone: "err", text: "Greška u komunikaciji s poslužiteljem." });
    } finally {
      setBusyId(null);
    }
  }

  function resendAck() {
    return call(
      "ack",
      () =>
        fetch(
          `/api/platform/registration-requests/${encodeURIComponent(
            props.requestId,
          )}/resend-ack`,
          { method: "POST" },
        ),
      `Potvrda ponovno poslana na ${props.contactEmail}.`,
    );
  }

  function resendAlert() {
    return call(
      "alert",
      () =>
        fetch(
          `/api/platform/registration-requests/${encodeURIComponent(
            props.requestId,
          )}/resend-alert`,
          { method: "POST" },
        ),
      `Alert ponovno poslan${props.vendorInbox ? ` na ${props.vendorInbox}` : ""}.`,
    );
  }

  function resendInvite() {
    if (!props.adminAccountId) return Promise.resolve();
    return call(
      "invite",
      () =>
        fetch(`/api/auth/invite/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountUserId: props.adminAccountId }),
        }),
      `Onboarding pozivnica ponovno poslana${
        props.adminAccountEmail ? ` na ${props.adminAccountEmail}` : ""
      }.`,
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {isPending && (
          <>
            <button
              type="button"
              className="btn btn-outline h-9 px-3 text-xs"
              disabled={busyId !== null}
              onClick={resendAck}
            >
              {busyId === "ack" ? "Šaljem…" : `Pošalji potvrdu korisniku ponovno`}
            </button>
            <button
              type="button"
              className="btn btn-outline h-9 px-3 text-xs"
              disabled={busyId !== null || !props.vendorInbox}
              onClick={resendAlert}
              title={
                props.vendorInbox
                  ? `Šalje na ${props.vendorInbox}`
                  : "Postavi VENDOR_ALERT_EMAIL u .env"
              }
            >
              {busyId === "alert" ? "Šaljem…" : "Pošalji alert mene ponovno"}
            </button>
          </>
        )}
        {isConverted && (
          <button
            type="button"
            className="btn btn-primary h-9 px-3 text-xs"
            disabled={busyId !== null}
            onClick={resendInvite}
          >
            {busyId === "invite"
              ? "Šaljem…"
              : "Pošalji onboarding pozivnicu ponovno"}
          </button>
        )}
        {!isPending && !isConverted && (
          <span className="text-xs text-slate-500">
            Nema dostupnih akcija za trenutni status.
          </span>
        )}
      </div>
      {toast && (
        <div
          className={`rounded-md border px-3 py-2 text-xs ${
            toast.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
