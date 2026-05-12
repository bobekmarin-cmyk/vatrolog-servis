"use client";

import { useState, type FormHTMLAttributes, type ReactNode } from "react";
import LoadingOverlay from "@/components/LoadingOverlay";

type Props = FormHTMLAttributes<HTMLFormElement> & {
  pendingTitle: string;
  pendingMessage?: string;
  children: ReactNode;
};

export default function PendingSubmitForm({
  pendingTitle,
  pendingMessage,
  children,
  onSubmit,
  ...props
}: Props) {
  const [pending, setPending] = useState(false);

  return (
    <>
      {pending ? <LoadingOverlay title={pendingTitle} message={pendingMessage} /> : null}
      <form
        {...props}
        onSubmit={(event) => {
          onSubmit?.(event);
          if (!event.defaultPrevented) setPending(true);
        }}
      >
        {children}
      </form>
    </>
  );
}
