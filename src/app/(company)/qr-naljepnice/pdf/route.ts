import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { FEATURE_KEYS, getCompanyFeatures, isFeatureEnabledForRole } from "@/lib/companyFeatures";
import {
  formatLabelCode,
  getLabelSheetPreset,
  validateLabelRange,
  type LabelSheetPreset,
} from "@/lib/labelSheets";
import { QrLabelSheetDocument, type QrLabel } from "@/pdf/QrLabelSheetDocument";
import { renderPdfToBuffer } from "@/lib/renderPdfToBuffer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: string | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/** Fini pomak ograničavamo na ±20 mm da se izbjegnu greške/zlouporabe. */
function clampOffset(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(-20, Math.min(20, v));
}

async function qrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, {
    // Tiha zona (quiet zone) oko koda za pouzdano skeniranje s male naljepnice.
    margin: 2,
    width: 320,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) redirect("/login");

  const features = await getCompanyFeatures(session.companyId);
  if (!isFeatureEnabledForRole(session.role, features, FEATURE_KEYS.QR_LABELS)) {
    return new Response("Zabranjeno.", { status: 403 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { name: true, serviceCode: true },
  });
  if (!company) redirect("/api/auth/logout");

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "calibration" ? "calibration" : "labels";
  const preset: LabelSheetPreset = getLabelSheetPreset(url.searchParams.get("preset"));
  const offsetX = clampOffset(num(url.searchParams.get("offsetX")));
  const offsetY = clampOffset(num(url.searchParams.get("offsetY")));

  if (mode === "calibration") {
    const buffer = await renderPdfToBuffer(
      QrLabelSheetDocument({ preset, offsetX, offsetY, servicerName: company.name, labels: [], mode: "calibration" }),
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="kalibracija-naljepnice.pdf"',
        "Cache-Control": "no-store",
      },
    });
  }

  const weight = num(url.searchParams.get("weight"));
  const from = num(url.searchParams.get("from"));
  const to = num(url.searchParams.get("to"));

  const check = validateLabelRange({ weight, from, to });
  if (!check.ok) {
    return new Response(check.error, { status: 400 });
  }

  const codes: string[] = [];
  for (let seq = from; seq <= to; seq++) {
    codes.push(formatLabelCode(company.serviceCode, weight, seq));
  }
  const labels: QrLabel[] = await Promise.all(
    codes.map(async (code) => ({ code, qrDataUrl: await qrDataUrl(code) })),
  );

  const buffer = await renderPdfToBuffer(
    QrLabelSheetDocument({ preset, offsetX, offsetY, servicerName: company.name, labels, mode: "labels" }),
  );

  const wcode = String(Math.trunc(weight)).padStart(3, "0");
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="qr-naljepnice-${wcode}-${from}-${to}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
