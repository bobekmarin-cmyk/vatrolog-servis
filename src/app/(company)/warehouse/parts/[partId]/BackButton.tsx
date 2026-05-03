"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Natrag gumb. Pokušava koristiti browser history (router.back()),
 * a ako nema povijesti (npr. izravno otvaranje linka) vraća na fallback URL.
 */
export default function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState<boolean>(false);

  useEffect(() => {
    setCanGoBack(typeof window !== "undefined" && window.history.length > 1);
  }, []);

  if (!canGoBack) {
    return (
      <Link
        href={fallbackHref}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
      >
        ← Natrag
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
    >
      ← Natrag
    </button>
  );
}
