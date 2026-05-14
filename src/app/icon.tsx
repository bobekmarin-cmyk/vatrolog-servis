import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Favicon (tab) — 32×32 PNG generiran na zahtjev. */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #ef4444 0%, #b91c1c 55%, #991b1b 100%)",
          borderRadius: "7px",
          position: "relative",
        }}
      >
        {/* Pojednostavljen vatrogasni aparat (bijeli siluet na crvenom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "1px",
          }}
        >
          <div
            style={{
              width: 14,
              height: 5,
              background: "#ffffff",
              borderRadius: 2,
            }}
          />
          <div
            style={{
              width: 16,
              height: 3,
              background: "#f8fafc",
              borderRadius: 1,
            }}
          />
          <div
            style={{
              width: 10,
              height: 13,
              background: "#ffffff",
              borderRadius: 3,
              marginTop: 1,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
