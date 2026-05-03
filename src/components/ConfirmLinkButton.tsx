"use client";

import { useRouter } from "next/navigation";
import { useDialog } from "@/components/ui/useDialog";

export default function ConfirmLinkButton({
  href,
  title,
  ariaLabel,
  confirmText,
  confirmTitle,
  confirmLabel,
  danger = true,
  disabled,
  children,
}: {
  href: string;
  title: string;
  ariaLabel: string;
  confirmText: string;
  confirmTitle?: string;
  confirmLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const dialog = useDialog();

  async function onClick() {
    if (disabled) return;
    const ok = await dialog.confirm({
      title: confirmTitle,
      message: confirmText,
      danger,
      confirmLabel,
    });
    if (ok) router.push(href);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border",
        disabled
          ? "cursor-not-allowed border-gray-200 text-gray-300"
          : "border-gray-200 text-gray-700 hover:bg-gray-50",
      ].join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
