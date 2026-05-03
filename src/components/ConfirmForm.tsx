"use client";

import { useRef, type ReactNode } from "react";
import { useDialog } from "@/components/ui/useDialog";

export default function ConfirmForm({
  action,
  method = "post",
  confirmMessage,
  confirmTitle,
  confirmLabel,
  danger = true,
  className,
  children,
}: {
  action: string;
  method?: "post" | "get";
  confirmMessage: string;
  confirmTitle?: string;
  confirmLabel?: string;
  danger?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const dialog = useDialog();
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) return;
    e.preventDefault();
    const ok = await dialog.confirm({
      title: confirmTitle,
      message: confirmMessage,
      danger,
      confirmLabel,
    });
    if (!ok) return;
    confirmed.current = true;
    formRef.current?.submit();
  }

  return (
    <form ref={formRef} action={action} method={method} className={className} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
