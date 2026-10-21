/**
 * Jednostranični A4 flyer: Korisnički portal VatroLog
 * za slanje kupcima (npr. od VATROBRAN d.o.o.).
 *
 * Pokretanje:
 *   npx ts-node -P tsconfig.seed.json scripts/generate-customer-portal-flyer.tsx
 */
import React from "react";
import path from "path";
import fs from "fs";
import { Document, Page, Text, View, Image, StyleSheet, renderToFile } from "@react-pdf/renderer";
import { registerPdfFonts } from "../src/pdf/registerPdfFonts";

registerPdfFonts();

const OUT_DIR = process.env.FLYER_OUT_DIR || "/opt/cursor/artifacts";
const OUT_FILE = path.join(OUT_DIR, "vatrolog-korisnicki-portal-flyer.pdf");
const LOGO_PATH = path.join(process.cwd(), "public", "icon-512.png");

/** Podaci servisera na flyeru — prilagodi po potrebi. */
const SERVICER = {
  name: "VATROBRAN d.o.o.",
  tagline: "Vaš ovlašteni servis vatrogasnih aparata",
  // Ostavi prazno ako ne želiš na flyeru; može se dopuniti kasnije.
  phone: "099/507-2023",
  email: "info@vatrobran.hr",
  web: "",
  address: "Vladimira Nazora 14, 42220 Novi Marof",
};

const PORTAL_URL = "https://vatrolog.com/korisnik";

const C = {
  red: "#b91c1c",
  redDeep: "#7f1d1d",
  redSoft: "#fef2f2",
  ink: "#0f172a",
  slate: "#334155",
  muted: "#64748b",
  line: "#e2e8f0",
  white: "#ffffff",
  paper: "#f8fafc",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    backgroundColor: C.white,
    color: C.ink,
    padding: 0,
  },

  hero: {
    backgroundColor: C.red,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: 36,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 9,
  },
  wordmarkRow: { flexDirection: "row", alignItems: "baseline" },
  wordVatro: {
    fontSize: 22,
    fontWeight: 700,
    color: C.white,
    letterSpacing: -0.4,
  },
  wordLog: {
    fontSize: 22,
    fontWeight: 700,
    color: "#fecaca",
    letterSpacing: -0.4,
  },
  heroBadge: {
    fontSize: 8,
    fontWeight: 700,
    color: C.white,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    opacity: 0.9,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: C.white,
    lineHeight: 1.25,
    maxWidth: 420,
  },
  heroLead: {
    marginTop: 8,
    fontSize: 10.5,
    color: "#fee2e2",
    lineHeight: 1.45,
    maxWidth: 440,
  },
  fromLine: {
    marginTop: 14,
    fontSize: 9,
    color: "#fecaca",
  },
  fromName: {
    fontSize: 11,
    fontWeight: 700,
    color: C.white,
    marginTop: 2,
  },

  body: {
    paddingHorizontal: 36,
    paddingTop: 20,
    paddingBottom: 56,
  },

  sectionLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: C.red,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },

  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  featureCard: {
    width: "48.5%",
    backgroundColor: C.paper,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 12,
    minHeight: 72,
  },
  featureCardWide: {
    width: "100%",
    minHeight: 0,
  },
  featureTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 4,
  },
  featureText: {
    fontSize: 8.8,
    color: C.slate,
    lineHeight: 1.4,
  },

  twoCol: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 16,
  },
  col: { flex: 1 },
  panel: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 8,
    padding: 12,
    minHeight: 110,
  },
  contactPanel: {
    backgroundColor: C.redSoft,
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 12,
    minHeight: 110,
  },
  contactName: {
    fontSize: 12,
    fontWeight: 700,
    color: C.redDeep,
    marginBottom: 2,
  },
  contactTagline: {
    fontSize: 8.5,
    color: C.red,
    marginBottom: 10,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  contactKey: {
    width: 46,
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    paddingTop: 1,
  },
  contactVal: {
    flex: 1,
    fontSize: 10,
    fontWeight: 700,
    color: C.ink,
  },
  panelTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 7,
    gap: 8,
  },
  stepNum: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.redSoft,
    color: C.red,
    fontSize: 8,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 2.5,
  },
  stepText: {
    flex: 1,
    fontSize: 9,
    color: C.slate,
    lineHeight: 1.35,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 5,
    gap: 6,
  },
  bullet: {
    width: 10,
    fontSize: 9,
    fontWeight: 700,
    color: C.red,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: C.slate,
    lineHeight: 1.35,
  },

  ctaBand: {
    marginTop: 4,
    backgroundColor: C.redDeep,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  ctaLeft: { flex: 1 },
  ctaEyebrow: {
    fontSize: 8,
    fontWeight: 700,
    color: "#fecaca",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  ctaUrl: {
    fontSize: 14,
    fontWeight: 700,
    color: C.white,
  },
  ctaHint: {
    marginTop: 3,
    fontSize: 8.5,
    color: "#fecaca",
  },
  ctaBox: {
    backgroundColor: C.white,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  ctaBoxText: {
    fontSize: 9,
    fontWeight: 700,
    color: C.redDeep,
    textAlign: "center",
  },

  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    fontSize: 7.5,
    color: C.muted,
    maxWidth: 360,
    lineHeight: 1.3,
  },
  footerBrand: { flexDirection: "row", alignItems: "baseline" },
  footerVatro: { fontSize: 9, fontWeight: 700, color: C.ink },
  footerLog: { fontSize: 9, fontWeight: 700, color: C.red },
});

const FEATURES = [
  {
    title: "Pregled stanja",
    text: "Na jednom mjestu vidite koliko aparata imate, koji su prekoračili servisni rok i koji uskoro ističu.",
  },
  {
    title: "Popis aparata",
    text: "Interni broj, tip, proizvođač, lokacija/odjeljenje i sljedeći rok periodičnog pregleda — s filterima po servisu.",
  },
  {
    title: "Redovni (tromjesečni) pregledi",
    text: "Vodite evidenciju pregleda koje obavljate sami. Skenirajte QR naljepnicu ili unesite pregled ručno.",
  },
  {
    title: "Dokumenti uz svaki nalog",
    text: "Preuzmite primku, upisnik, otpremnicu i račun izravno iz portala — bez traženja po e-mailu.",
  },
  {
    title: "Korisnici vaše tvrtke",
    text: "Administrator pozove kolege e-mailom i dodijeli ulogu. Svi vide iste aparate i dokumente tvrtke.",
  },
];

function Flyer() {
  const contactBits = [SERVICER.phone, SERVICER.email, SERVICER.web].filter(Boolean);
  const contactLine =
    contactBits.length > 0
      ? `Za pozivnicu nas kontaktirajte: ${contactBits.join(" · ")}`
      : "Za pristup zatražite pozivnicu od svog servisera.";

  return (
    <Document
      title="VatroLog Korisnički portal — flyer"
      author={SERVICER.name}
      subject="Objašnjenje Korisničkog portala za vlasnike vatrogasnih aparata"
      language="hr-HR"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.brandRow}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image */}
              <Image src={LOGO_PATH} style={styles.logo} />
              <View>
                <View style={styles.wordmarkRow}>
                  <Text style={styles.wordVatro}>Vatro</Text>
                  <Text style={styles.wordLog}>Log</Text>
                </View>
                <Text style={styles.heroBadge}>Korisnički portal</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroTitle}>
            Svi vaši vatrogasni aparati{"\n"}na jednom mjestu
          </Text>
          <Text style={styles.heroLead}>
            Digitalni portal za vlasnike i korisnike aparata. Pratite servisne rokove, preuzimate
            dokumente i vodite tromjesečne preglede — 24/7, s računala ili mobitela.
          </Text>

          <Text style={styles.fromLine}>Šalje vam vaš serviser</Text>
          <Text style={styles.fromName}>{SERVICER.name}</Text>
          {SERVICER.tagline ? (
            <Text style={{ fontSize: 8.5, color: "#fecaca", marginTop: 2 }}>{SERVICER.tagline}</Text>
          ) : null}
        </View>

        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Što sve možete</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f, i) => {
              const isLastOdd = FEATURES.length % 2 === 1 && i === FEATURES.length - 1;
              return (
                <View
                  key={f.title}
                  style={isLastOdd ? [styles.featureCard, styles.featureCardWide] : styles.featureCard}
                  wrap={false}
                >
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureText}>{f.text}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.twoCol}>
            <View style={styles.col}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Kako početi</Text>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>1</Text>
                  <Text style={styles.stepText}>
                    Serviser ({SERVICER.name}) pošalje pozivnicu na e-mail administratora vaše tvrtke.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>2</Text>
                  <Text style={styles.stepText}>
                    Otvorite poveznicu iz maila, postavite lozinku i aktivirajte račun.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <Text style={styles.stepNum}>3</Text>
                  <Text style={styles.stepText}>
                    Prijavite se na {PORTAL_URL.replace("https://", "")} i po potrebi pozovite kolege.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.col}>
              <View style={styles.contactPanel}>
                <Text style={styles.contactName}>{SERVICER.name}</Text>
                {SERVICER.tagline ? <Text style={styles.contactTagline}>{SERVICER.tagline}</Text> : null}
                {SERVICER.phone ? (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactKey}>Tel</Text>
                    <Text style={styles.contactVal}>{SERVICER.phone}</Text>
                  </View>
                ) : null}
                {SERVICER.email ? (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactKey}>E-mail</Text>
                    <Text style={styles.contactVal}>{SERVICER.email}</Text>
                  </View>
                ) : null}
                {SERVICER.address ? (
                  <View style={styles.contactRow}>
                    <Text style={styles.contactKey}>Adresa</Text>
                    <Text style={styles.contactVal}>{SERVICER.address}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.ctaBand}>
            <View style={styles.ctaLeft}>
              <Text style={styles.ctaEyebrow}>Prijava u portal</Text>
              <Text style={styles.ctaUrl}>{PORTAL_URL.replace("https://", "")}</Text>
              <Text style={styles.ctaHint}>{contactLine}</Text>
            </View>
            <View style={styles.ctaBox}>
              <Text style={styles.ctaBoxText}>Besplatno{"\n"}za naše kupce</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerLeft}>
            {SERVICER.name} koristi platformu VatroLog za vođenje servisa. Portal je namijenjen
            vlasnicima aparata koje servisiramo.
          </Text>
          <View style={styles.footerBrand}>
            <Text style={styles.footerVatro}>Vatro</Text>
            <Text style={styles.footerLog}>Log</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!fs.existsSync(LOGO_PATH)) {
    throw new Error(`Nedostaje logo: ${LOGO_PATH}`);
  }
  await renderToFile(<Flyer />, OUT_FILE);
  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
