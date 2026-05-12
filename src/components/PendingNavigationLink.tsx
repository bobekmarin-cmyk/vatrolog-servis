"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LoadingOverlay from "@/components/LoadingOverlay";

type Props = {
  href: string;
  className?: string;
  pendingTitle: string;
  pendingMessage?: string;
  children: ReactNode;
};

export default function PendingNavigationLink({
  href,
  className,
  pendingTitle,
  pendingMessage,
  children,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    if (pending) return;
    setPending(true);
    router.push(href);
  }

  return (
    <>
      {pending ? <LoadingOverlay title={pendingTitle} message={pendingMessage} /> : null}
      <a href={href} className={className} onClick={handleClick} aria-busy={pending}>
        {children}
      </a>
    </>
  );
}
