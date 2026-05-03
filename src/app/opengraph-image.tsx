import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export const alt =
  "VatroLog — digitalni servis vatrogasnih aparata. Nalozi, evidencija, upisnici, izvještaji.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Auto-generirani OG / Twitter image (1200x630) — koristi se na svim
 * stranicama koje nemaju vlastitu opengraph-image. Next.js auto-injecta
 * <meta property="og:image"> u <head> bez dodatnog konfiga.
 */
export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "linear-gradient(135deg, #fff7ed 0%, #fee2e2 35%, #fecaca 70%, #fff 100%)",
          color: "#0f172a",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "#dc2626",
              color: "white",
              fontSize: "32px",
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            V
          </div>
          <div style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.02em" }}>
            VatroLog
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "baseline",
              fontSize: "72px",
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: "920px",
            }}
          >
            <span>Digitalni servis </span>
            <span style={{ color: "#dc2626" }}>vatrogasnih aparata</span>
            <span>, bez papira i Excela.</span>
          </div>
          <div
            style={{
              fontSize: "26px",
              color: "#475569",
              maxWidth: "880px",
              lineHeight: 1.35,
            }}
          >
            Servisni nalozi, evidencija aparata, upisnici i izvještaji u jednom
            alatu — za servisere u Hrvatskoj.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: "#64748b",
            fontSize: "20px",
          }}
        >
          <div>vatrolog.hr</div>
          <div>14 dana probnog rada · bez kartice</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
