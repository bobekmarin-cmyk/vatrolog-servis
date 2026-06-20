/* eslint-disable jsx-a11y/alt-text -- @react-pdf <Image> nije HTML <img>; alt ne postoji */
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { mm, type LabelSheetPreset } from "@/lib/labelSheets";
import { registerPdfFonts } from "./registerPdfFonts";

registerPdfFonts();

export type QrLabel = { code: string; qrDataUrl: string };

const styles = StyleSheet.create({
  page: { fontFamily: "Roboto", position: "relative" },
  cell: { position: "absolute", flexDirection: "column", alignItems: "center", justifyContent: "center" },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoVatro: { fontWeight: 700, color: "#0f172a", letterSpacing: -0.3 },
  logoLog: { fontWeight: 700, color: "#dc2626", letterSpacing: -0.3 },
  code: { fontWeight: 700, color: "#0f172a", textAlign: "center" },
  servicer: { color: "#475569", textAlign: "center" },

  // Kalibracija
  calCell: { position: "absolute", borderWidth: 0.5, borderColor: "#94a3b8", alignItems: "center", justifyContent: "center" },
  calCellText: { fontSize: 7, color: "#475569", textAlign: "center" },
  calLineH: { position: "absolute", height: 0.8, backgroundColor: "#dc2626" },
  calLineV: { position: "absolute", width: 0.8, backgroundColor: "#dc2626" },
  calTick: { position: "absolute", backgroundColor: "#dc2626" },
  calText: { position: "absolute", fontSize: 8, color: "#dc2626", fontWeight: 700 },
  calInfo: { position: "absolute", fontSize: 8, color: "#0f172a" },
});

function cellPosition(preset: LabelSheetPreset, index: number, offsetX: number, offsetY: number) {
  const col = index % preset.columns;
  const row = Math.floor(index / preset.columns);
  const left = preset.marginLeft + offsetX + col * (preset.labelWidth + preset.columnGap);
  const top = preset.marginTop + offsetY + row * (preset.labelHeight + preset.rowGap);
  return { left: mm(left), top: mm(top), width: mm(preset.labelWidth), height: mm(preset.labelHeight) };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function LabelCell({
  preset,
  index,
  offsetX,
  offsetY,
  label,
  servicerName,
}: {
  preset: LabelSheetPreset;
  index: number;
  offsetX: number;
  offsetY: number;
  label: QrLabel;
  servicerName: string;
}) {
  const pos = cellPosition(preset, index, offsetX, offsetY);

  if (preset.layout === "horizontal") {
    // QR lijevo, tekst desno — za niske/uske naljepnice.
    const padding = mm(preset.labelHeight * 0.06);
    const qr = mm(preset.labelHeight) * 0.82;
    const logoSize = mm(preset.labelHeight) * 0.11;
    const codeSize = mm(preset.labelHeight) * 0.1;
    const servicerSize = mm(preset.labelHeight) * 0.075;

    return (
      <View style={[styles.cell, { ...pos, padding, flexDirection: "row" }]}>
        <Image src={label.qrDataUrl} style={{ width: qr, height: qr }} />
        <View style={{ flex: 1, flexDirection: "column", justifyContent: "center", paddingLeft: mm(1.5) }}>
          <View style={styles.logoRow}>
            <Text style={[styles.logoVatro, { fontSize: logoSize }]}>Vatro</Text>
            <Text style={[styles.logoLog, { fontSize: logoSize }]}>Log</Text>
          </View>
          <Text style={[styles.code, { fontSize: codeSize, marginTop: mm(0.6), textAlign: "left" }]}>
            {label.code}
          </Text>
          <Text
            style={[styles.servicer, { fontSize: servicerSize, marginTop: mm(0.4), textAlign: "left" }]}
            wrap={false}
          >
            {servicerName}
          </Text>
        </View>
      </View>
    );
  }

  // Okomiti raspored — logo / QR / kod / servis naslagani (veće naljepnice).
  const qr = mm(Math.min(preset.labelWidth, preset.labelHeight) * 0.5);
  const logoSize = mm(preset.labelHeight) * 0.09;
  const codeSize = mm(preset.labelHeight) * 0.085;
  const servicerSize = mm(preset.labelHeight) * 0.058;
  const padding = mm(2);

  return (
    <View style={[styles.cell, { ...pos, padding }]}>
      <View style={[styles.logoRow, { marginBottom: mm(1) }]}>
        <Text style={[styles.logoVatro, { fontSize: logoSize }]}>Vatro</Text>
        <Text style={[styles.logoLog, { fontSize: logoSize }]}>Log</Text>
      </View>
      <Image src={label.qrDataUrl} style={{ width: qr, height: qr }} />
      <Text style={[styles.code, { fontSize: codeSize, marginTop: mm(1) }]}>{label.code}</Text>
      <Text style={[styles.servicer, { fontSize: servicerSize, marginTop: mm(0.5) }]} wrap={false}>
        {servicerName}
      </Text>
    </View>
  );
}

function CalibrationPage({
  preset,
  offsetX,
  offsetY,
}: {
  preset: LabelSheetPreset;
  offsetX: number;
  offsetY: number;
}) {
  const perPage = preset.columns * preset.rows;
  const cells = Array.from({ length: perPage }, (_, i) => i);
  // Referentna linija 100 mm (horizontalna i vertikalna) iz gornjeg lijevog kuta.
  const refLen = 100;
  const originX = 10;
  const originY = 8;
  const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  return (
    <Page size={[mm(preset.page.width), mm(preset.page.height)]} style={styles.page}>
      <Text style={[styles.calInfo, { top: mm(2), left: mm(originX) }]}>
        KALIBRACIJA — ispis na 100% / „Stvarna veličina”. Linije moraju mjeriti točno 100 mm. Okviri = {preset.labelWidth} × {preset.labelHeight} mm.
      </Text>

      {/* Okviri naljepnica (provjera poklapanja s rezanim arkom) */}
      {cells.map((i) => {
        const pos = cellPosition(preset, i, offsetX, offsetY);
        const fontSize = Math.min(7, mm(preset.labelHeight) * 0.11);
        return (
          <View key={i} style={[styles.calCell, pos]}>
            <Text style={[styles.calCellText, { fontSize }]}>
              {preset.labelWidth} × {preset.labelHeight} mm
            </Text>
          </View>
        );
      })}

      {/* Horizontalna referentna linija 100 mm */}
      <View style={[styles.calLineH, { left: mm(originX), top: mm(originY), width: mm(refLen) }]} />
      {ticks.map((t) => (
        <View
          key={`h${t}`}
          style={[styles.calTick, { left: mm(originX + t), top: mm(originY - 1.5), width: 0.6, height: mm(3) }]}
        />
      ))}
      <Text style={[styles.calText, { left: mm(originX + refLen + 2), top: mm(originY - 1.5) }]}>100 mm</Text>

      {/* Vertikalna referentna linija 100 mm */}
      <View style={[styles.calLineV, { left: mm(originX), top: mm(originY), height: mm(refLen) }]} />
      {ticks.map((t) => (
        <View
          key={`v${t}`}
          style={[styles.calTick, { left: mm(originX - 1.5), top: mm(originY + t), width: mm(3), height: 0.6 }]}
        />
      ))}
      <Text style={[styles.calText, { left: mm(originX + 2), top: mm(originY + refLen) }]}>100 mm</Text>
    </Page>
  );
}

export function QrLabelSheetDocument({
  preset,
  offsetX = 0,
  offsetY = 0,
  servicerName,
  labels,
  mode = "labels",
}: {
  preset: LabelSheetPreset;
  offsetX?: number;
  offsetY?: number;
  servicerName: string;
  labels: QrLabel[];
  mode?: "labels" | "calibration";
}) {
  if (mode === "calibration") {
    return (
      <Document title="Kalibracija naljepnica">
        <CalibrationPage preset={preset} offsetX={offsetX} offsetY={offsetY} />
      </Document>
    );
  }

  const perPage = preset.columns * preset.rows;
  const pages = chunk(labels, perPage);

  return (
    <Document title="QR naljepnice">
      {pages.map((pageLabels, pageIndex) => (
        <Page key={pageIndex} size={[mm(preset.page.width), mm(preset.page.height)]} style={styles.page}>
          {pageLabels.map((label, i) => (
            <LabelCell
              key={label.code}
              preset={preset}
              index={i}
              offsetX={offsetX}
              offsetY={offsetY}
              label={label}
              servicerName={servicerName}
            />
          ))}
        </Page>
      ))}
    </Document>
  );
}
