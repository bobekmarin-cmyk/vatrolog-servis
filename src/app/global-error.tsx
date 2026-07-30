"use client";

import { useEffect } from "react";

/**
 * Zadnja linija obrane — hvata i greške u root layoutu, zato nosi vlastiti
 * `<html>`/`<body>` i ne može koristiti aplikacijske stilove.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        lvl: "error",
        evt: "global_error_boundary",
        message: error.message,
        digest: error.digest ?? null,
      }),
    );
  }, [error]);

  return (
    <html lang="hr">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            padding: 28,
            borderRadius: 14,
            background: "#fff",
            border: "1px solid #e2e8f0",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>VatroLog trenutno nije dostupan</h1>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 20px" }}>
            Dogodila se neočekivana greška. Vaši podaci su sigurni. Pokušajte ponovno.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "9px 18px",
              borderRadius: 8,
              border: "none",
              background: "#dc2626",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Pokušaj ponovno
          </button>
          {error.digest ? (
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 16, fontFamily: "monospace" }}>
              Kod: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
