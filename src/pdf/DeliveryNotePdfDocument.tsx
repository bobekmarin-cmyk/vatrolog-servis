import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { type CompanyHeaderInfo } from "./PdfCompanyHeader";
import { PdfDocumentFooter, PdfDocumentHeader, PdfWatermark } from "./PdfLayout";
import { registerPdfFonts } from "./registerPdfFonts";

registerPdfFonts();

export type DeliveryNoteServiceRow = {
  /** "Periodični pregled" ili "Unutarnji pregled" */
  kindLabel: string;
  /** Npr. "P2 (ST, prah)" ili "CO2-5" */
  itemLabel: string;
  /** Računovodstvena šifra iz CompanyServiceCatalog-a; null -> "—" */
  code: string | null;
  quantity: number;
};

/** Agregirani red tablice dijelova (jedan red po dijelu, zbrojena količina). */
export type DeliveryNotePartAggregated = {
  /** Računovodstvena (tenantova) šifra; "—" ako nema. Za vlastite dijelove je njihova šifra. */
  code: string;
  /** Naziv dijela ili tekstualni opis manualnog unosa. */
  name: string;
  /**
   * Tvornička šifra (samo za platform dijelove); prikazuje se zasivljeno
   * uz naziv. Null/undefined za vlastite ili manualne unose.
   */
  manufacturerCode?: string | null;
  /** Zbrojena količina ili null kad nije mjerljiva (manualni tekst). */
  quantity: number | null;
  /** Mjerna jedinica ("kom" / "kg" / "L"). Null za tekstualne stavke bez količine. */
  unit?: string | null;
};

/** Red tablice "Servisne naljepnice" (potrošnja pri zaključavanju naloga). */
export type DeliveryNoteLabelRow = {
  /** Šifra naljepnice iz postavki → Ovlaštenja; ako je prazna, ispisuje se "—". */
  code: string | null;
  /** Puni naziv naljepnice s proizvođačem, npr. "Naljepnica periodičnog pregleda (PASTOR)". */
  name: string;
  quantity: number;
};

export type DeliveryNoteCustomerInfo = {
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

export type DeliveryNoteDates = {
  receiptDate: string;
  orderDate: string;
  deliveryNoteDate: string;
};

export type DeliveryNoteStatus = "DRAFT" | "IN_PROGRESS" | "LOCKED";

export type DeliveryNotePdfData = {
  company: CompanyHeaderInfo;
  orderNumber: string;
  customer: DeliveryNoteCustomerInfo;
  dates: DeliveryNoteDates;
  /** Napomena s otvaranja radnog naloga — ispod broja/datuma (kao na upisniku/primci). */
  orderNote?: string | null;
  serviceFooterLine?: string | null;
  status: DeliveryNoteStatus;
  docId: string;
  generatedAtLabel: string;
  appVersion: string;
  qrDataUrl: string | null;
  services: DeliveryNoteServiceRow[];
  partsAggregated: DeliveryNotePartAggregated[];
  labels: DeliveryNoteLabelRow[];
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
    fontSize: 9.2,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },

  table: {
    marginTop: 2,
  },
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
  tr: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#edf2f7",
  },
  trAlt: {},
  td: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 8.6,
    color: "#0f172a",
  },

  colQty: { width: 60, textAlign: "center" as const },

  colService: { flex: 1, minWidth: 220 },
  colServiceKind: { fontWeight: 700 as const, color: "#0f172a" },
  colServiceItem: { color: "#334155" },
  colCode: { width: 90 },
  colCodeMono: { fontFamily: "Courier" as const, color: "#475569", fontSize: 8 },

  colPartCode: { width: 90 },
  colPartName: { flex: 1, minWidth: 220 },
  colPartQty: { width: 70, textAlign: "center" as const },

  empty: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: "left" as const,
    color: "#94a3b8",
    fontSize: 8.5,
  },

  sigBox: {
    alignSelf: "flex-end",
    width: 210,
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
  sigRow: { flexDirection: "row" },
  sigCol: { flex: 1 },

  footerNotes: { marginBottom: 4 },
  footerNoteText: { fontSize: 6.5, color: "#64748b", lineHeight: 1.3 },
  footerNoteBold: { fontSize: 6.5, color: "#0f172a", fontWeight: 700, lineHeight: 1.3 },

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

function formatCustomerAddress(c: DeliveryNoteCustomerInfo): string {
  const line =
    c.street && c.city
      ? `${c.street}, ${c.postalCode ? c.postalCode + " " : ""}${c.city}`
      : c.address;
  return line || "—";
}

export default function DeliveryNotePdfDocument({ data }: { data: DeliveryNotePdfData }) {
  const {
    company,
    orderNumber,
    customer,
    dates,
    orderNote,
    serviceFooterLine,
    status,
    docId,
    generatedAtLabel,
    appVersion,
    qrDataUrl,
    services,
    partsAggregated,
    labels,
  } = data;

  const noteText = orderNote?.trim() || "";
  const addressLine = formatCustomerAddress(customer);

  const contacts: Array<{ label: string; value: string }> = [];
  if (customer.contactPerson) contacts.push({ label: "Kontakt osoba", value: customer.contactPerson });
  if (customer.phone) contacts.push({ label: "Telefon", value: customer.phone });
  if (customer.email) contacts.push({ label: "E-mail", value: customer.email });

  const showWatermark = status === "DRAFT" || status === "IN_PROGRESS";
  const watermarkLabel = status === "DRAFT" ? "NACRT" : "U RADU";
  const watermarkColor = status === "DRAFT" ? "#dc2626" : "#d97706";

  const hasParts = partsAggregated.length > 0;
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
            <Text style={styles.introTitle}>Otpremnica</Text>
            <View style={styles.introAccent} />
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Broj naloga</Text>
              <Text style={styles.introMetaValue}>{orderNumber}</Text>
            </View>
            <View style={styles.introMetaRow}>
              <Text style={styles.introMetaKey}>Datum otpremnice</Text>
              <Text style={styles.introMetaValue}>{dates.deliveryNoteDate}</Text>
            </View>
            <View style={styles.introMetaRowLast}>
              <Text style={styles.introMetaKey}>Datum primitka na servis</Text>
              <Text style={styles.introMetaValue}>{dates.receiptDate}</Text>
            </View>
            {noteText ? (
              <View style={styles.introOrderNote}>
                <Text style={styles.introOrderNoteLabel}>Napomena</Text>
                <Text style={styles.introOrderNoteText}>{noteText}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* IZVRŠENE USLUGE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Izvršene usluge</Text>
        </View>
        <View style={styles.table}>
          <View style={styles.tableHead} fixed>
            <Text style={[styles.th, styles.colCode]}>Šifra</Text>
            <Text style={[styles.th, styles.colService]}>Usluga</Text>
            <Text style={[styles.th, styles.colQty]}>Količina</Text>
          </View>
          {services.length === 0 ? (
            <View style={styles.tr}>
              <Text style={styles.empty}>Nema izvršenih usluga.</Text>
            </View>
          ) : (
            services.map((s, idx) => (
              <View
                key={`s-${idx}`}
                style={idx % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}
                wrap={false}
              >
                <Text style={[styles.td, styles.colCode, styles.colCodeMono]}>
                  {s.code && s.code.length > 0 ? s.code : "—"}
                </Text>
                <Text style={[styles.td, styles.colService]}>
                  <Text style={styles.colServiceKind}>{s.kindLabel}</Text>
                  <Text style={styles.colServiceItem}> {s.itemLabel}</Text>
                </Text>
                <Text style={[styles.td, styles.colQty]}>{s.quantity}</Text>
              </View>
            ))
          )}
        </View>

        {/* UGRAĐENI DIJELOVI */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ugrađeni dijelovi</Text>
        </View>
        {!hasParts ? (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={styles.empty}>Nema evidentiranih dijelova.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHead} fixed>
              <Text style={[styles.th, styles.colPartCode]}>Šifra</Text>
              <Text style={[styles.th, styles.colPartName]}>Naziv</Text>
              <Text style={[styles.th, styles.colPartQty]}>Količina</Text>
            </View>
            {partsAggregated.map((p, idx) => (
              <View
                key={`p-${idx}`}
                style={idx % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}
                wrap={false}
              >
                <Text style={[styles.td, styles.colPartCode, styles.colCodeMono]}>
                  {p.code && p.code.length > 0 ? p.code : "—"}
                </Text>
                <Text style={[styles.td, styles.colPartName]}>
                  {p.name}
                  {p.manufacturerCode ? (
                    <>
                      {"  "}
                      <Text style={styles.colCodeMono}>{p.manufacturerCode}</Text>
                    </>
                  ) : null}
                </Text>
                <Text style={[styles.td, styles.colPartQty]}>
                  {p.quantity == null
                    ? "—"
                    : p.unit && p.unit.length > 0
                      ? `${p.quantity} ${p.unit}`
                      : String(p.quantity)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* SERVISNE NALJEPNICE */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Servisne naljepnice</Text>
        </View>
        {labels.length === 0 ? (
          <View style={styles.table}>
            <View style={styles.tr}>
              <Text style={styles.empty}>Nema evidentirane potrošnje naljepnica.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHead} fixed>
              <Text style={[styles.th, styles.colPartCode]}>Šifra</Text>
              <Text style={[styles.th, styles.colPartName]}>Naziv</Text>
              <Text style={[styles.th, styles.colPartQty]}>Količina</Text>
            </View>
            {labels.map((l, idx) => (
              <View
                key={`l-${idx}`}
                style={idx % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}
                wrap={false}
              >
                <Text style={[styles.td, styles.colPartCode, styles.colCodeMono]}>
                  {l.code && l.code.length > 0 ? l.code : "—"}
                </Text>
                <Text style={[styles.td, styles.colPartName]}>{l.name}</Text>
                <Text style={[styles.td, styles.colPartQty]}>{l.quantity}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.spacer} />
        <View style={styles.sigBox} wrap={false}>
          <Text style={styles.sigTitle}>Preuzeo kupac</Text>
          <View style={styles.sigLine} />
          <Text style={styles.sigCaption}>Potpis i pečat</Text>
        </View>

        {showWatermark ? <PdfWatermark label={watermarkLabel} color={watermarkColor} /> : null}

        <PdfDocumentFooter
          docId={docId}
          generatedAtLabel={generatedAtLabel}
          appVersion={appVersion}
          metaLine={serviceFooterLine}
          note="Otpremnica prati servisirane vatrogasne aparate prilikom isporuke kupcu. Preuzimanjem potvrđujete količine i ugrađene rezervne dijelove navedene u ovom dokumentu."
          boldNote="Dokument je elektronički generiran i vrijedi bez potpisa servisera."
        />
      </Page>
    </Document>
  );
}
