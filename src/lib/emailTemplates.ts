import { prisma } from "@/lib/prisma";
import { renderEmailShell } from "@/lib/email/layout";
import type { EmailBranding } from "@/lib/email/components";

export const TEMPLATE_TYPES = [
  "BEGINNING",
  "BEFORE_EXPIRY",
  "AFTER_EXPIRY",
  "REGISTER",
  "RECEIPT",
  "DELIVERY_NOTE",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** Predlošci koji se koriste za slanje PDF priloga (radni nalog dokumenti). */
export const PDF_TEMPLATE_TYPES = ["REGISTER", "RECEIPT", "DELIVERY_NOTE"] as const;
export type PdfTemplateType = (typeof PDF_TEMPLATE_TYPES)[number];

export interface TemplateFields {
  type: string;
  label: string;
  subject: string;
  greeting: string;
  bodyText: string;
  calloutText: string;
  closingText: string;
  footerNote: string | null;
}

const DEFAULTS: Record<TemplateType, TemplateFields> = {
  BEGINNING: {
    type: "BEGINNING",
    label: "Početak mjeseca",
    subject: "Obavijest o isteku servisa vatrogasnih aparata - {mjesec}",
    greeting: "Poštovani,",
    bodyText:
      "obavještavamo Vas da Vam u mjesecu {mjesec} ističe rok servisa za {broj} vatrogasnih aparata.",
    calloutText: "Broj aparata kojima ističe servis: {broj}",
    closingText:
      "Molimo Vas da nas kontaktirate radi dogovora oko servisiranja Vaših vatrogasnih aparata kako biste ostali u skladu s propisima.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
  BEFORE_EXPIRY: {
    type: "BEFORE_EXPIRY",
    label: "5 dana prije isteka",
    subject: "PODSJETNIK: Istek servisa vatrogasnih aparata - {mjesec}",
    greeting: "Poštovani,",
    bodyText:
      "podsjećamo Vas da za 5 dana ističe rok servisa za {broj} vatrogasnih aparata. Molimo hitnu reakciju kako biste izbjegli kršenje propisa.",
    calloutText: "Rok ističe krajem mjeseca {mjesec} — preostalo je samo 5 dana!",
    closingText:
      "Molimo Vas da nas hitno kontaktirate radi dogovora oko servisiranja.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
  AFTER_EXPIRY: {
    type: "AFTER_EXPIRY",
    label: "Nakon isteka",
    subject: "HITNO: Istekao rok servisa vatrogasnih aparata",
    greeting: "Poštovani,",
    bodyText:
      "obavještavamo Vas da je istekao rok servisa za {broj} vatrogasnih aparata. Vaši aparati više nisu u skladu s propisima i potrebno je hitno servisiranje.",
    calloutText: "Broj aparata s isteklim rokom: {broj}",
    closingText:
      "Molimo Vas da nas što hitnije kontaktirate kako bismo dogovorili termin servisiranja i doveli Vaše aparate u ispravno stanje.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
  REGISTER: {
    type: "REGISTER",
    label: "Slanje upisnika",
    subject: "Upisnik servisiranih vatrogasnih aparata - nalog {nalog}",
    greeting: "Poštovani,",
    bodyText:
      "u prilogu Vam šaljemo upisnik za radni nalog {nalog}.",
    calloutText: "Upisnik sadrži {broj} servisiranih aparata.",
    closingText:
      "Molimo Vas da pregledate upisnik i kontaktirate nas u slučaju pitanja.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
  RECEIPT: {
    type: "RECEIPT",
    label: "Slanje primke",
    subject: "Primka - nalog {nalog}",
    greeting: "Poštovani,",
    bodyText:
      "u prilogu Vam šaljemo primku za radni nalog {nalog} kojom potvrđujemo zaprimanje Vaših vatrogasnih aparata na servis.",
    calloutText: "Zaprimljeno aparata: {broj}",
    closingText:
      "O statusu servisa obavijestit ćemo Vas na vrijeme. Za sva pitanja stojimo Vam na raspolaganju.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
  DELIVERY_NOTE: {
    type: "DELIVERY_NOTE",
    label: "Slanje otpremnice",
    subject: "Otpremnica - nalog {nalog}",
    greeting: "Poštovani,",
    bodyText:
      "u prilogu Vam šaljemo otpremnicu za radni nalog {nalog} kojom potvrđujemo isporuku servisiranih vatrogasnih aparata.",
    calloutText: "Otpremljeno aparata: {broj}",
    closingText:
      "Molimo Vas da pregledate priloženi dokument. Za sva pitanja ili eventualne reklamacije stojimo Vam na raspolaganju.",
    footerNote:
      "Ova poruka je automatski generirana iz sustava za upravljanje servisom vatrogasnih aparata.",
  },
};

export function getDefaultTemplate(type: TemplateType): TemplateFields {
  return { ...DEFAULTS[type] };
}

export async function ensureDefaultTemplates(companyId: string) {
  const existing = await prisma.emailTemplate.findMany({
    where: { companyId },
    select: { type: true },
  });
  const existingTypes = new Set(existing.map((e) => e.type));

  for (const type of TEMPLATE_TYPES) {
    if (!existingTypes.has(type)) {
      const d = DEFAULTS[type];
      await prisma.emailTemplate.create({
        data: { companyId, ...d },
      });
    }
  }

  return prisma.emailTemplate.findMany({
    where: { companyId },
    orderBy: { type: "asc" },
  });
}

function replacePlaceholders(
  text: string,
  vars: { mjesec: string; broj: number; kupac: string; tvrtka: string; nalog?: string },
): string {
  return text
    .replace(/\{mjesec\}/g, vars.mjesec)
    .replace(/\{broj\}/g, String(vars.broj))
    .replace(/\{kupac\}/g, vars.kupac)
    .replace(/\{tvrtka\}/g, vars.tvrtka)
    .replace(/\{nalog\}/g, vars.nalog ?? "");
}

export interface RenderVars {
  mjesec: string;
  broj: number;
  kupac: string;
  tvrtka: string;
  nalog?: string;
}

/** Mapping tipa predloška → naslov i labela koji se prikazuju u headeru maila. */
const TEMPLATE_HEADER: Record<string, { heading: string; label: string }> = {
  REGISTER: {
    heading: "Upisnik servisiranih vatrogasnih aparata",
    label: "Upisnik",
  },
  RECEIPT: {
    heading: "Primka vatrogasnih aparata",
    label: "Primka",
  },
  DELIVERY_NOTE: {
    heading: "Otpremnica vatrogasnih aparata",
    label: "Otpremnica",
  },
};

const DEFAULT_HEADER = {
  heading: "Obavijest o servisu vatrogasnih aparata",
  label: "Obavijest",
};

/**
 * Renderira tenant → kupac mail koristeći zajednički `renderEmailShell` iz
 * `src/lib/email/layout.ts`. Sva polja iz baze (greeting, bodyText, callout,
 * closing, footer) prolaze kroz placeholder zamjenu i sklapaju se u isti
 * vizualni shell kao i vendor mailovi (PDF-style dizajn).
 *
 * `vars.tvrtka` se koristi kao `branding.fromName` u headeru. Brand boja je
 * fiksno crvena za sve obavijesti (jednako kao u PDF-u). PDF predlošci
 * (REGISTER/RECEIPT/DELIVERY_NOTE) koriste vlastiti heading + documentLabel
 * preko `TEMPLATE_HEADER` mape.
 */
export function renderTemplateHtml(template: TemplateFields, vars: RenderVars): string {
  const greeting = replacePlaceholders(template.greeting, vars);
  const body = replacePlaceholders(template.bodyText, vars);
  const callout = replacePlaceholders(template.calloutText, vars);
  const closing = replacePlaceholders(template.closingText, vars);
  const footer = template.footerNote ? replacePlaceholders(template.footerNote, vars) : null;

  const branding: EmailBranding = {
    fromName: vars.tvrtka,
    fromEmail: "",
    signatureHtml: `S poštovanjem,<br/><strong>${escapeBasic(vars.tvrtka)}</strong>`,
    logoUrl: null,
    brandColor: "#dc2626",
  };

  const header = TEMPLATE_HEADER[template.type] ?? DEFAULT_HEADER;

  const { html } = renderEmailShell({
    subject: header.heading,
    fields: {
      greeting,
      bodyText: body,
      calloutText: callout,
      closingText: closing,
      footerNote: footer,
    },
    branding,
    documentLabel: header.label,
  });

  return html;
}

function escapeBasic(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

export function renderSubject(template: TemplateFields, vars: RenderVars): string {
  return replacePlaceholders(template.subject, vars);
}
