"use client";

import { useRef } from "react";

/**
 * Gumb za POST akciju koji prije submit-a pita za confirm.
 * Koristi nativni `confirm()` dijalog — minimalno i sigurno (server-action style).
 */
export default function DangerConfirmButton({
  action,
  confirmText,
  buttonLabel,
  buttonClass = "btn btn-outline h-9 px-4 text-sm text-red-700",
}: {
  action: string;
  confirmText: string;
  buttonLabel: string;
  buttonClass?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function onClick() {
    if (typeof window !== "undefined" && window.confirm(confirmText)) {
      formRef.current?.submit();
    }
  }

  return (
    <form ref={formRef} action={action} method="post">
      <button type="button" className={buttonClass} onClick={onClick}>
        {buttonLabel}
      </button>
    </form>
  );
}
