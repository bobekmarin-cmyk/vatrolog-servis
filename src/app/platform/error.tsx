"use client";

import ErrorBoundaryScreen from "@/components/ErrorBoundaryScreen";

export default function PlatformAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundaryScreen
      error={error}
      reset={reset}
      title="Platform stranica se nije učitala"
      homeHref="/platform"
      homeLabel="Platform dashboard"
    />
  );
}
