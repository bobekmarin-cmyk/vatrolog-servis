import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { type CompanyHeaderInfo } from "./PdfCompanyHeader";
import { PdfDocumentFooter, PdfDocumentHeader, PdfWatermark } from "./PdfLayout";
import { registerPdfFonts } from "./registerPdfFonts";

registerPdfFonts();

export type PrimkaItemRow = {
  rbr: number;
  internalCode: string;
  manufacturer: string;
  type: string;
  serial: string;
  year: string;
  note: string;
};

export type PrimkaCustomerInfo = {
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

export type PrimkaDates = {
  receiptDate: string;
  dueDate: string;
  printDate: string;
};

export type PrimkaStatus = "DRAFT" | "IN_PROGRESS" | "LOCKED";

export type PrimkaPdfData = {
  company: CompanyHeaderInfo;
  orderNumber: string;
  customer: PrimkaCustomerInfo;
  dates: PrimkaDates;
  deliveryModeLabel: string;
  serviceFooterLine?: string | null;
  status: PrimkaStatus;
  docId: string;
  generatedAtLabel: string;
  appVersion: string;
  qrDataUrl: string | null;
  rows: PrimkaItemRow[];
  /**
   * Retci primitka iz live stavki naloga (zbroj = broj redaka u tablici).
   * Isti dan kao primitak = jedan redak „primljeno”; drugi dan = „dodatna”.
   */
  receiptDeliveryLines: string[];
  /** Još neidentificirani aparati (placeholderi u tablici). */
  unidentifiedPlaceholderCount: number;
  note: string | null;
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
  introOrderNote: {
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: "#e2e8f0",
  },
  introOrderNoteLabel: {
    fontSize: 6.8,
    color: "#64748b",
    letterSpacing: 0.7,
    textTransform: "uppercase" as const,
    fontWeight: 700,
    marginBottom: 3,
  },
  introOrderNoteText: {
    fontSize: 8.2,
    color: "#0f172a",
    lineHeight: 1.35,
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

  sectionHeader: {
    marginTop: 12,
    marginBottom: 0,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 400,
    color: "#0f172a",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },

  /** Jednoličan tekst u bloku primitka / tablice (font i veličina). */
  receiptBlockText: {
    fontSize: 9,
    fontFamily: "Roboto",
    fontWeight: 400,
    color: "#0f172a",
  },

  tableListTitle: {
    fontSize: 8,
    fontFamily: "Roboto",
    fontWeight: 400,
    color: "#0f172a",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginTop: 16,
    marginBottom: 4,
  },

  table: { marginTop: 0 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  th: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    fontSize: 7.4,
    fontWeight: 700,
    fontFamily: "Roboto",
    color: "#64748b",
    letterSpacing: 0.35,
    textTransform: "uppercase" as const,
  },
  tr: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#edf2f7",
    minHeight: 16,
  },
  trAlt: {},
  td: {
    paddingVertical: 2.5,
    paddingHorizontal: 3,
    fontSize: 7.8,
    fontWeight: 400,
    fontFamily: "Roboto",
    color: "#0f172a",
  },
  tdMono: {
    fontFamily: "Roboto",
    fontSize: 7.4,
  },

  colRbr: { width: 24, textAlign: "center" as const },
  colCode: { width: 78 },
  colMan: { width: 108 },
  colType: { width: 100 },
  colSerial: { width: 72 },
  colYear: { width: 34, textAlign: "center" as const },
  colNote: { flex: 1 },

  empty: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: "left" as const,
    color: "#94a3b8",
    fontSize: 9,
    fontFamily: "Roboto",
    fontWeight: 400,
  },
  receivedSummary: {
    marginTop: 8,
    marginBottom: 3,
  },
  subsequentLine: {
    marginBottom: 3,
  },

  unidentifiedFooter: {
    fontSize: 7,
    fontFamily: "Roboto",
    fontWeight: 400,
    color: "#64748b",
    marginTop: 8,
  },

  sigBoxRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 22,
    marginTop: 14,
    marginBottom: 6,
  },
  sigBox: {
    width: 210,
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
  sigRow: { flexDirection: "row" },
  sigCol: { flex: 1 },

  footerNotes: { marginBottom: 4 },
  footerNoteText: { fontSize: 6.5, color: "#64748b", lineHeight: 1.3 },
  footerNoteBold: { fontSize: 6.5, color: "#0f172a", fontWeight: 700, lineHeight: 1.3 },

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

function formatCustomerAddress(c: PrimkaCustomerInfo): string {
  const line =
    c.street && c.city
      ? `${c.street}, ${c.postalCode ? c.postalCode + " " : ""}${c.city}`
      : c.address;
  return line || "—";
}

export default function PrimkaPdfDocument({ data }: { data: PrimkaPdfData }) {
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
    receiptDeliveryLines,
    unidentifiedPlaceholderCount,
    note,
  } = data;

  const addressLine = formatCustomerAddress(customer);

  const contacts: Array<{ label: string; value: string }> = [];
  if (customer.contactPerson) contacts.push({ label: "Kontakt osoba", value: customer.contactPerson });
  if (customer.phone) contacts.push({ label: "Telefon", value: customer.phone });
  if (customer.email) contacts.push({ label: "E-mail", value: customer.email });

  const showWatermark = status === "DRAFT" || status === "IN_PROGRESS";
  const watermarkLabel = status === "DRAFT" ? "NACRT" : "U RADU";
  const watermarkColor = status === "DRAFT" ? "#dc2626" : "#d97706";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
            <Text style={styles.introTitle}>Primka</Text>
            <View style={styles.introAccent} />
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Broj naloga</Text>
              <Text style={styles.introMetaValue}>{orderNumber}</Text>
            </View>
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Datum primitka</Text>
              <Text style={styles.introMetaValue}>{dates.receiptDate}</Text>
            </View>
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Planirani datum završetka</Text>
              <Text style={styles.introMetaValue}>{dates.dueDate}</Text>
            </View>
            {note && note.trim().length > 0 ? (
              <View style={styles.introOrderNote}>
                <Text style={styles.introOrderNoteLabel}>Napomena</Text>
                <Text style={styles.introOrderNoteText}>{note.trim()}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Primljeni aparati</Text>
        </View>
        {receiptDeliveryLines.length > 0 ? (
          receiptDeliveryLines.map((line, i) => (
            <Text
              key={`recv-${i}`}
              style={[
                styles.receiptBlockText,
                i === 0 ? styles.receivedSummary : styles.subsequentLine,
              ]}
              wrap={false}
            >
              {line}
            </Text>
          ))
        ) : (
          <Text style={[styles.receiptBlockText, styles.empty]} wrap={false}>
            Nema aparata u tablici naloga.
          </Text>
        )}
        {rows.length > 0 ? (
          <>
            <Text style={styles.tableListTitle} wrap={false}>
              POPIS PRIMLJENIH APARATA
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHead} fixed>
                <Text style={[styles.th, styles.colRbr]}>R.br.</Text>
                <Text style={[styles.th, styles.colCode]}>Interni br.</Text>
                <Text style={[styles.th, styles.colMan]}>Proizvođač</Text>
                <Text style={[styles.th, styles.colType]}>Tip</Text>
                <Text style={[styles.th, styles.colSerial]}>Serijski</Text>
                <Text style={[styles.th, styles.colYear]}>God.</Text>
                <Text style={[styles.th, styles.colNote]}>Napomena</Text>
              </View>
              {rows.map((r, idx) => (
                <View
                  key={`r-${idx}`}
                  style={idx % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}
                  wrap={false}
                >
                  <Text style={[styles.td, styles.colRbr]} wrap={false}>
                    {r.rbr}
                  </Text>
                  <Text style={[styles.td, styles.tdMono, styles.colCode]} wrap={false}>
                    {r.internalCode}
                  </Text>
                  <Text style={[styles.td, styles.colMan]} wrap={false}>
                    {r.manufacturer}
                  </Text>
                  <Text style={[styles.td, styles.colType]} wrap={false}>
                    {r.type}
                  </Text>
                  <Text style={[styles.td, styles.colSerial]} wrap={false}>
                    {r.serial || "-"}
                  </Text>
                  <Text style={[styles.td, styles.colYear]} wrap={false}>
                    {r.year || "-"}
                  </Text>
                  <Text style={[styles.td, styles.colNote]} wrap={false}>
                    {r.note || ""}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : unidentifiedPlaceholderCount === 0 ? (
          <Text style={[styles.receiptBlockText, styles.empty, { marginTop: 8 }]}>
            Nema identificiranih aparata u tablici.
          </Text>
        ) : null}
        {unidentifiedPlaceholderCount > 0 ? (
          <Text style={styles.unidentifiedFooter} wrap={false}>
            Još nije identificirano u tablici: {unidentifiedPlaceholderCount}{" "}
            {unidentifiedPlaceholderCount === 1 ? "aparat" : "aparata"}
          </Text>
        ) : null}

        <View style={styles.spacer} />
        <View style={styles.sigBoxRow} wrap={false}>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Izdao kupac</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigCaption}>Potpis i pečat</Text>
          </View>
          <View style={styles.sigBox}>
            <Text style={styles.sigTitle}>Primio serviser</Text>
            <View style={styles.sigLine} />
            <Text style={styles.sigCaption}>Potpis i pečat</Text>
          </View>
        </View>

        {showWatermark ? <PdfWatermark label={watermarkLabel} color={watermarkColor} /> : null}

        <PdfDocumentFooter
          docId={docId}
          generatedAtLabel={generatedAtLabel}
          appVersion={appVersion}
          metaLine={serviceFooterLine}
          note="Inicijalni primitak odgovara količini s kreiranja naloga. Naknadno dodani aparati (još bez internog broja u tablici) navedeni su po datumu dostave (kalendarski dan). Aparati u tablici su identificirani u radionici."
          boldNote="Dokument je elektronički generiran i vrijedi bez potpisa servisera."
        />
      </Page>
    </Document>
  );
}
