import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { type CompanyHeaderInfo } from "./PdfCompanyHeader";
import { PdfDocumentFooter, PdfDocumentHeader, PdfWatermark } from "./PdfLayout";
import { registerPdfFonts } from "./registerPdfFonts";

registerPdfFonts();

export type RegisterRow = {
  rbr: number;
  manufacturer: string;
  type: string;
  agent: string;
  serial: string | null;
  year: number | null;
  internal: string;
  internalDone: boolean;
  parts: string;
  nextPeriodic: string;
  nextInternal: string;
  location: string;
  label: string;
  servicedAt: string;
};

export type RegisterCustomerInfo = {
  displayName: string;
  fullName: string;
  oib: string;
  address: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  department: string | null;
};

export type RegisterDates = {
  receiptDate: string;
  orderDate: string;
  registerDate: string;
};

export type RegisterStatus = "DRAFT" | "IN_PROGRESS" | "LOCKED";

export type RegisterPdfData = {
  company: CompanyHeaderInfo;
  orderNumber: string;
  customer: RegisterCustomerInfo;
  dates: RegisterDates;
  /** Način servisa (stacionarni vs vozilo); null/undefined = ne prikazuj. */
  serviceContextLabel?: string | null;
  serviceFooterLine?: string | null;
  status: RegisterStatus;
  docId: string;
  generatedAtLabel: string;
  appVersion: string;
  qrDataUrl: string | null;
  rows: RegisterRow[];
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 78,
    paddingHorizontal: 26,
    fontSize: 9,
    fontFamily: "Roboto",
    color: "#0f172a",
    flexDirection: "column",
  },

  spacer: { flexGrow: 1 },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  companyBlock: { flexDirection: "column", flex: 1 },
  companyName: { fontSize: 12, fontWeight: 700, color: "#0f172a" },
  companyLine: { fontSize: 8, color: "#475569", marginTop: 1 },

  brandBlock: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  brandText: { flexDirection: "column", alignItems: "flex-end" },
  logoRow: { flexDirection: "row", alignItems: "baseline" },
  logoVatro: { fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: -0.3 },
  logoLog: { fontSize: 20, fontWeight: 700, color: "#dc2626", letterSpacing: -0.3 },
  qrImage: { width: 54, height: 54 },

  title: { fontSize: 13, fontWeight: 700, color: "#0f172a" },
  orderLine: { fontSize: 8.5, color: "#475569", marginTop: 2, marginBottom: 10 },
  orderLineBold: { fontWeight: 700, color: "#0f172a" },
  orderLineStrong: { fontWeight: 700, color: "#0f172a", fontSize: 10 },

  introGrid: {
    flexDirection: "row",
    gap: 28,
    marginTop: 2,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  introPanel: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 0,
    minHeight: 98,
  },
  introDocPanel: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 0,
    minHeight: 98,
  },
  introLabel: {
    fontSize: 6.8,
    color: "#64748b",
    letterSpacing: 0.9,
    textTransform: "uppercase" as const,
    fontWeight: 700,
  },
  introAccent: {
    width: 32,
    height: 2,
    backgroundColor: "#dc2626",
    marginTop: 5,
    marginBottom: 9,
  },
  introCustomerName: { fontSize: 18, fontWeight: 700, color: "#0f172a", marginBottom: 7 },
  introCustomerLine: { fontSize: 8.2, color: "#0f172a", marginTop: 4 },
  introCustomerMuted: { fontSize: 8, color: "#475569", marginTop: 4 },
  introTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  introSubtitle: {
    fontSize: 6.8,
    color: "#94a3b8",
    letterSpacing: 0.7,
    textTransform: "uppercase" as const,
  },
  introMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 2.2,
  },
  introMetaRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 2.2,
  },
  introMetaKey: {
    fontSize: 7.8,
    color: "#64748b",
  },
  introMetaValue: {
    fontSize: 8.6,
    color: "#0f172a",
    fontWeight: 700,
    textAlign: "right" as const,
  },

  infoRow: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 10,
    alignItems: "stretch",
  },

  hCardCustomer: {
    flex: 2,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  hCardMeta: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  hLabel: {
    fontSize: 7,
    color: "#64748b",
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    marginBottom: 2,
    fontWeight: 700,
  },
  hCustomerName: { fontSize: 10.5, fontWeight: 700, color: "#0f172a" },
  hCustomerMeta: { fontSize: 7.8, color: "#334155", marginTop: 2 },
  hCustomerContactRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
    flexWrap: "wrap",
  },
  hDetailCol: { flexDirection: "column" },
  hDetailLabel: {
    fontSize: 6.5,
    color: "#64748b",
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  hDetailValue: { fontSize: 8.5, color: "#0f172a", marginTop: 1 },
  hMetaLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 3,
  },
  hMetaKey: { fontSize: 7.5, color: "#64748b" },
  hMetaValue: { fontSize: 9, color: "#0f172a", fontWeight: 700 },

  table: { marginTop: 2 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  th: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7.4,
    fontWeight: 700,
    color: "#64748b",
    letterSpacing: 0.4,
    textTransform: "uppercase" as const,
  },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#edf2f7" },
  trAlt: {},
  trInternal: { backgroundColor: "#eff6ff" },
  td: { paddingVertical: 3, paddingHorizontal: 4, fontSize: 7.8, color: "#0f172a" },

  colRbr: { width: 26, textAlign: "center" as const },
  colMfr: { width: 70 },
  colType: { width: 80 },
  colAgent: { width: 58 },
  colSerial: { width: 72 },
  colYear: { width: 34, textAlign: "center" as const },
  colInt: { width: 34, textAlign: "center" as const },
  colParts: { flex: 1, minWidth: 90 },
  colNextP: { width: 58, textAlign: "center" as const },
  colNextI: { width: 58, textAlign: "center" as const },
  colLoc: { width: 76 },
  colLabel: { width: 66 },
  colDate: { width: 62, textAlign: "center" as const },

  empty: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: "left" as const,
    color: "#94a3b8",
    fontSize: 8.5,
  },

  sigBox: {
    alignSelf: "flex-end",
    width: 460,
    marginTop: 14,
    marginBottom: 6,
  },
  sigTitle: {
    fontSize: 7,
    color: "#64748b",
    letterSpacing: 0.6,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    marginBottom: 4,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#475569",
    marginTop: 18,
    marginBottom: 3,
  },
  sigCaption: { fontSize: 7, color: "#64748b", textAlign: "center" as const },
  sigRow: { flexDirection: "row", gap: 22 },
  sigCol: { flex: 1 },

  footerNotes: { marginBottom: 4 },
  footerNoteText: { fontSize: 6.5, color: "#64748b", lineHeight: 1.3 },
  footerNoteBold: { fontSize: 6.5, color: "#0f172a", fontWeight: 700, lineHeight: 1.3 },

  legend: {
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  legendItem: { fontSize: 7, color: "#64748b" },

  // Watermark
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
  watermarkDraft: { color: "#dc2626" },
  watermarkInProgress: { color: "#d97706" },

  // Footer
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
});

function formatCustomerAddress(c: RegisterCustomerInfo): string {
  const line =
    c.street && c.city
      ? `${c.street}, ${c.postalCode ? c.postalCode + " " : ""}${c.city}`
      : c.address;
  return line || "—";
}

type TableItem = { kind: "row"; key: string; row: RegisterRow; zebra: boolean };

function buildTableItems(rows: RegisterRow[]): { items: TableItem[] } {
  const items: TableItem[] = rows.map((r, idx) => ({
    kind: "row",
    key: `r-${r.rbr}`,
    row: r,
    zebra: idx % 2 === 1,
  }));
  return { items };
}

function rowStyle(r: RegisterRow, zebra: boolean): Style[] {
  const out: Style[] = [styles.tr];
  if (zebra) out.push(styles.trAlt);
  if (r.internalDone) out.push(styles.trInternal);
  return out;
}

export default function RegisterPdfDocument({ data }: { data: RegisterPdfData }) {
  const {
    company,
    orderNumber,
    customer,
    dates,
    serviceFooterLine,
    status,
    docId,
    generatedAtLabel,
    appVersion,
    qrDataUrl,
    rows,
  } = data;
  const addressLine = formatCustomerAddress(customer);

  const contacts: Array<{ label: string; value: string }> = [];
  if (customer.contactPerson) contacts.push({ label: "Kontakt osoba", value: customer.contactPerson });
  if (customer.phone) contacts.push({ label: "Telefon", value: customer.phone });
  if (customer.email) contacts.push({ label: "E-mail", value: customer.email });

  const { items: tableItems } = buildTableItems(rows);

  const showWatermark = status === "DRAFT" || status === "IN_PROGRESS";
  const watermarkLabel = status === "DRAFT" ? "NACRT" : "U RADU";
  const watermarkColor = status === "DRAFT" ? "#dc2626" : "#d97706";

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <PdfDocumentHeader
          company={company}
          qrDataUrl={qrDataUrl}
          documentTitle=""
        />

        <View style={styles.introGrid} wrap={false}>
          <View style={styles.introPanel}>
            <Text style={styles.introLabel}>Kupac</Text>
            <View style={styles.introAccent} />
            <Text style={styles.introCustomerName}>{customer.displayName}</Text>
            <Text style={styles.introCustomerLine}>OIB: {customer.oib}</Text>
            <Text style={styles.introCustomerLine}>{addressLine}</Text>
            {customer.department ? (
              <Text style={styles.introCustomerMuted}>Odjel: {customer.department}</Text>
            ) : null}
            {contacts.length > 0
              ? contacts.map((d) => (
                  <Text key={d.label} style={styles.introCustomerMuted}>
                    {d.label}: {d.value}
                  </Text>
                ))
              : null}
          </View>

          <View style={styles.introDocPanel}>
            <Text style={styles.introTitle}>Upisnik</Text>
            <Text style={styles.introSubtitle}>
              Evidencija izvršenog pregleda vatrogasnih aparata
            </Text>
            <View style={styles.introAccent} />
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Broj naloga</Text>
              <Text style={styles.introMetaValue}>{orderNumber}</Text>
            </View>
            <View style={styles.introMetaRowLast}>
              <Text style={styles.introMetaKey}>Datum upisnika</Text>
              <Text style={styles.introMetaValue}>{dates.registerDate}</Text>
            </View>
          </View>
        </View>

        {/* TABLICA */}
        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colRbr]}>R.br.</Text>
            <Text style={[styles.th, styles.colMfr]}>Proizvođač</Text>
            <Text style={[styles.th, styles.colType]}>Tip</Text>
            <Text style={[styles.th, styles.colAgent]}>Punjenje</Text>
            <Text style={[styles.th, styles.colSerial]}>Serijski</Text>
            <Text style={[styles.th, styles.colYear]}>God.</Text>
            <Text style={[styles.th, styles.colInt]}>Unut.</Text>
            <Text style={[styles.th, styles.colParts]}>Dijelovi</Text>
            <Text style={[styles.th, styles.colNextP]}>Idući PP</Text>
            <Text style={[styles.th, styles.colNextI]}>Idući UP</Text>
            <Text style={[styles.th, styles.colLoc]}>Lokacija</Text>
            <Text style={[styles.th, styles.colLabel]}>Naljepnica</Text>
            <Text style={[styles.th, styles.colDate]}>Datum</Text>
          </View>
          {tableItems.length === 0 ? (
            <View style={styles.tr}>
              <Text style={styles.empty}>Nema popunjenih aparata u nalogu.</Text>
            </View>
          ) : (
            tableItems.map((it) => (
              <View key={it.key} style={rowStyle(it.row, it.zebra)} wrap={false}>
                <Text style={[styles.td, styles.colRbr]}>{it.row.rbr}</Text>
                <Text style={[styles.td, styles.colMfr]}>{it.row.manufacturer}</Text>
                <Text style={[styles.td, styles.colType]}>{it.row.type}</Text>
                <Text style={[styles.td, styles.colAgent]}>{it.row.agent}</Text>
                <Text style={[styles.td, styles.colSerial]}>{it.row.serial ?? "-"}</Text>
                <Text style={[styles.td, styles.colYear]}>{it.row.year ?? "-"}</Text>
                <Text style={[styles.td, styles.colInt]}>{it.row.internal}</Text>
                <Text style={[styles.td, styles.colParts]}>{it.row.parts}</Text>
                <Text style={[styles.td, styles.colNextP]}>{it.row.nextPeriodic}</Text>
                <Text style={[styles.td, styles.colNextI]}>{it.row.nextInternal}</Text>
                <Text style={[styles.td, styles.colLoc]}>{it.row.location}</Text>
                <Text style={[styles.td, styles.colLabel]}>{it.row.label}</Text>
                <Text style={[styles.td, styles.colDate]}>{it.row.servicedAt}</Text>
              </View>
            ))
          )}
        </View>

        {/* LEGENDA */}
        <View style={styles.legend}>
          <Text style={styles.legendItem}>PP = periodični pregled</Text>
          <Text style={styles.legendItem}>·</Text>
          <Text style={styles.legendItem}>UP = unutarnji pregled</Text>
          <Text style={styles.legendItem}>·</Text>
          <Text style={styles.legendItem}>ST = stalni tlak</Text>
          <Text style={styles.legendItem}>·</Text>
          <Text style={styles.legendItem}>BO = bočica</Text>
          <Text style={styles.legendItem}>·</Text>
          <Text style={styles.legendItem}>
            Svijetloplavi retci = na aparatu obavljen unutarnji pregled
          </Text>
        </View>

        <View style={styles.spacer} />
        <View style={styles.sigBox} wrap={false}>
          <View style={styles.sigRow}>
            <View style={styles.sigCol}>
              <Text style={styles.sigTitle}>Pripremio serviser</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigCaption}>Potpis i pečat</Text>
            </View>
            <View style={styles.sigCol}>
              <Text style={styles.sigTitle}>Preuzeo kupac</Text>
              <View style={styles.sigLine} />
              <Text style={styles.sigCaption}>Potpis i pečat</Text>
            </View>
          </View>
        </View>

        {showWatermark ? <PdfWatermark label={watermarkLabel} color={watermarkColor} /> : null}

        <PdfDocumentFooter
          docId={docId}
          generatedAtLabel={generatedAtLabel}
          appVersion={appVersion}
          metaLine={serviceFooterLine}
          note="Servis i periodični pregled izvršeni su u skladu s Pravilnikom o održavanju i izboru vatrogasnih aparata (NN 101/2011 i kasnije izmjene)."
          boldNote="Dokument je elektronički generiran i vrijedi bez potpisa servisera."
        />
      </Page>
    </Document>
  );
}
