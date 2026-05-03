import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";

export type CompanyHeaderInfo = {
  name: string;
  oib: string;
  street: string;
  city: string;
  postalCode: string;
  iban: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
};

const styles = StyleSheet.create({
  header: { marginBottom: 16 },
  companyName: { fontSize: 16, fontWeight: 700, textAlign: "center" as const, marginBottom: 4 },
  companyDetails: { textAlign: "center" as const, fontSize: 10, color: "#475569", marginBottom: 4 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginTop: 8, marginBottom: 16 },
});

export default function PdfCompanyHeader({ company }: { company: CompanyHeaderInfo }) {
  return (
    <View style={styles.header}>
      <Text style={styles.companyName}>{company.name}</Text>
      <Text style={styles.companyDetails}>
        {company.street}, {company.postalCode} {company.city}
      </Text>
      <Text style={styles.companyDetails}>OIB: {company.oib}  ·  IBAN: {company.iban}</Text>
      <View style={styles.divider} />
    </View>
  );
}
