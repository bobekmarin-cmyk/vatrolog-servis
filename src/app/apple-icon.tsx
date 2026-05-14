import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Apple touch icon (180×180). Isti vizual kao favicon, veća rezolucija. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          borderRadius: "40px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: "6px",
          }}
        >
          <div
            style={{
              width: 78,
              height: 28,
              background: "#ffffff",
              borderRadius: 10,
            }}
          />
          <div
            style={{
              width: 88,
              height: 16,
              background: "#f8fafc",
              borderRadius: 6,
              marginTop: -2,
            }}
          />
          <div
            style={{
              width: 56,
              height: 72,
              background: "#ffffff",
              borderRadius: 16,
              marginTop: 4,
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
