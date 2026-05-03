import React from "react";
import { StyleSheet, Text, View } from "@react-pdf/renderer";
import { type CompanyHeaderInfo } from "./PdfCompanyHeader";

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  companyBlock: { flexDirection: "column", flex: 1, paddingRight: 12 },
  companyName: { fontSize: 12, fontWeight: 700, color: "#0f172a" },
  companyLine: { fontSize: 8, color: "#475569", marginTop: 1 },
  docBlock: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  docText: { flexDirection: "column", alignItems: "flex-end", minWidth: 150 },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoVatro: { fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: -0.3 },
  logoLog: { fontSize: 20, fontWeight: 700, color: "#dc2626", letterSpacing: -0.3 },
  docTitle: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: 700,
    color: "#334155",
    letterSpacing: 0.8,
    textTransform: "uppercase" as const,
  },
  docMeta: { marginTop: 2, fontSize: 7.2, color: "#64748b", textAlign: "right" as const },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 26,
    right: 26,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
    flexDirection: "column",
  },
  footerCompactText: { fontSize: 6.5, color: "#94a3b8", lineHeight: 1.15 },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  footerLeft: { fontSize: 7, color: "#94a3b8", flex: 1 },
  footerCenter: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    flex: 1,
  },
  footerVatro: { fontSize: 8, fontWeight: 700, color: "#0f172a" },
  footerLog: { fontSize: 8, fontWeight: 700, color: "#dc2626" },
  footerVer: { fontSize: 7, color: "#94a3b8", marginLeft: 4 },
  footerPage: { fontSize: 7, color: "#94a3b8", flex: 1, textAlign: "right" as const },

  watermark: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  watermarkText: {
    fontSize: 130,
    fontWeight: 700,
    letterSpacing: 6,
    opacity: 0.12,
    transform: "rotate(-22deg)",
  },
});

export function PdfDocumentHeader({
  company,
  documentTitle,
  meta,
}: {
  company: CompanyHeaderInfo;
  qrDataUrl: string | null;
  documentTitle: string;
  meta?: string;
}) {
  const contacts = [
    company.contactName ? `Kontakt: ${company.contactName}` : null,
    company.phone ? `Tel: ${company.phone}` : null,
    company.email ? `Mail: ${company.email}` : null,
  ].filter((v): v is string => !!v);

  return (
    <View style={styles.headerRow}>
      <View style={styles.companyBlock}>
        <Text style={styles.companyName}>{company.name}</Text>
        <Text style={styles.companyLine}>
          {company.street}, {company.postalCode} {company.city}
        </Text>
        <Text style={styles.companyLine}>OIB: {company.oib}  ·  IBAN: {company.iban}</Text>
        {contacts.length > 0 ? (
          <Text style={styles.companyLine}>{contacts.join("  ·  ")}</Text>
        ) : null}
      </View>
      <View style={styles.docBlock}>
        <View style={styles.docText}>
          <View style={styles.logoRow}>
            <Text style={styles.logoVatro}>Vatro</Text>
            <Text style={styles.logoLog}>Log</Text>
          </View>
          {documentTitle ? <Text style={styles.docTitle}>{documentTitle}</Text> : null}
          {meta ? <Text style={styles.docMeta}>{meta}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function PdfDocumentFooter({
  docId,
  generatedAtLabel,
  appVersion,
  metaLine,
  note,
  boldNote,
}: {
  docId: string;
  generatedAtLabel: string;
  appVersion: string;
  metaLine?: string | null;
  note: string;
  boldNote?: string;
}) {
  const noteParts = [metaLine, note, boldNote].filter((v): v is string => !!v);

  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerCompactText}>{noteParts.join("  ·  ")}</Text>
      <View style={styles.footerRow}>
        <Text style={styles.footerLeft}>
          {docId}  ·  Generirano: {generatedAtLabel}
        </Text>
        <View style={styles.footerCenter}>
          <Text style={styles.footerVatro}>Vatro</Text>
          <Text style={styles.footerLog}>Log</Text>
          <Text style={styles.footerVer}>v{appVersion}</Text>
        </View>
        <Text
          style={styles.footerPage}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </View>
  );
}

export function PdfWatermark({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <View style={styles.watermark} fixed>
      <Text style={[styles.watermarkText, { color }]}>{label}</Text>
    </View>
  );
}
