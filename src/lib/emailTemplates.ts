import { prisma } from "@/lib/prisma";

export const TEMPLATE_TYPES = ["BEGINNING", "BEFORE_EXPIRY", "AFTER_EXPIRY", "REGISTER"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

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
      "Molimo Vas da pregledajte upisnik i kontaktirate nas u slučaju pitanja.",
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

export function renderTemplateHtml(template: TemplateFields, vars: RenderVars): string {
  const greeting = replacePlaceholders(template.greeting, vars);
  const body = replacePlaceholders(template.bodyText, vars);
  const callout = replacePlaceholders(template.calloutText, vars);
  const closing = replacePlaceholders(template.closingText, vars);
  const footer = template.footerNote
    ? replacePlaceholders(template.footerNote, vars)
    : "";

  const isRegister = template.type === "REGISTER";
  const accentColor = isRegister ? "#2563eb" : "#dc2626";
  const calloutBg = isRegister ? "#eff6ff" : "#fef2f2";
  const headerSubtitle = isRegister
    ? "Upisnik servisiranih vatrogasnih aparata"
    : "Obavijest o servisu vatrogasnih aparata";

  return `<!DOCTYPE html>
<html lang="hr">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="border-bottom: 3px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px;">
    <h2 style="margin: 0; color: ${accentColor};">${vars.tvrtka}</h2>
    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">${headerSubtitle}</p>
  </div>

  <p>${greeting}</p>

  <p>${body}</p>

  <div style="background: ${calloutBg}; border-left: 4px solid ${accentColor}; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
    <strong>${callout}</strong>
  </div>

  <p>${closing}</p>

  <p style="margin-top: 32px;">S poštovanjem,<br><strong>${vars.tvrtka}</strong></p>

  <hr style="border: none; border-top: 1px solid #eee; margin-top: 32px;">
  ${footer ? `<p style="font-size: 11px; color: #999;">${footer}</p>` : ""}
</body>
</html>`;
}

export function renderSubject(template: TemplateFields, vars: RenderVars): string {
  return replacePlaceholders(template.subject, vars);
}
