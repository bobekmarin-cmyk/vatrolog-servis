/**
 * Vendor → tenant transactional email predlošci.
 *
 * Defaultni sadržaj (subject + 5 polja) živi ovdje u kodu kako bi sustav
 * uvijek imao radnu verziju i bez seedanja baze. Override za pojedini tip
 * sprema se u `PlatformEmailTemplate` Prisma model i ima prednost.
 *
 * `renderVendorTemplate(type, vars, branding)`:
 *   1. učita override iz baze (ako postoji) i složi `TemplateFields`,
 *   2. zamijeni `{{variable}}` placeholdere u svim tekstualnim poljima
 *      (HTML escape se primjenjuje automatski),
 *   3. dodatne strukturne elemente (CTA gumb, šifra, key/value tablica)
 *      sastavi prema tipu i proslijedi kao `extraHtml`,
 *   4. proslijedi sve kroz `renderEmailShell` u `./layout`.
 */

import { prisma } from "@/lib/prisma";
import {
  emailButton,
  emailCodeBlock,
  emailKeyValueRows,
  type EmailBranding,
} from "./components";
import { escapeHtml, renderEmailShell, type RenderedEmail } from "./layout";

export const VENDOR_TEMPLATE_TYPES = [
  "PASSWORD_RESET",
  "EMAIL_VERIFICATION",
  "ADMIN_ONBOARDING",
  "SUBACCOUNT_SETUP",
  "REGISTRATION_REQUEST_RECEIVED",
  "REGISTRATION_REQUEST_REJECTED",
  "REGISTRATION_REQUEST_VENDOR_ALERT",
  "SUBSCRIPTION_EXPIRING",
  "OWNER_PORTAL_INVITE",
  "OWNER_PORTAL_NEW_SERVICER",
  "OWNER_PORTAL_ACCESS_REQUEST",
  "OWNER_INSPECTION_REMINDER",
] as const;

export type VendorTemplateType = (typeof VENDOR_TEMPLATE_TYPES)[number];

export type VendorTemplateFields = {
  subject: string;
  greeting: string;
  bodyText: string;
  calloutText: string;
  closingText: string;
  footerNote: string | null;
};

export type VendorTemplateVariable = {
  /** Ime placeholdera bez vitičastih zagrada (npr. "resetUrl"). */
  name: string;
  /** Što varijabla znači — prikazuje se editor korisniku. */
  description: string;
  /** Sample vrijednost za live preview / test mail. */
  example: string;
};

export type VendorTemplateDef = {
  type: VendorTemplateType;
  label: string;
  description: string;
  fields: VendorTemplateFields;
  variables: readonly VendorTemplateVariable[];
};

/**
 * Defaultni predlošci za sve vendor tipove.
 * Tekstovi koriste `{{variable}}` placeholdere; popis dostupnih varijabli je
 * uz svaki predložak.
 */
export const VENDOR_TEMPLATE_DEFAULTS: Record<VendorTemplateType, VendorTemplateDef> = {
  PASSWORD_RESET: {
    type: "PASSWORD_RESET",
    label: "Obnova lozinke",
    description:
      "Šalje se kad korisnik zatraži reset lozinke. Sadrži CTA gumb sa sigurnosnim linkom (vrijedi 30 minuta).",
    fields: {
      subject: "{{appName}} — obnova lozinke",
      greeting: "Pozdrav,",
      bodyText:
        "Zatražili ste obnovu lozinke za Vaš {{appName}} račun. Klikom na gumb ispod postavljate novu lozinku.",
      calloutText: "Sigurnosni link vrijedi 30 minuta od trenutka slanja ove poruke.",
      closingText:
        "Ako niste tražili obnovu lozinke, slobodno ignorirajte ovu poruku — Vaš račun ostaje nepromijenjen.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme (iz brandinga).", example: "VatroLog" },
      { name: "resetUrl", description: "Sigurnosni link za postavljanje nove lozinke.", example: "https://vatrolog.com/reset-password?token=abc123" },
    ],
  },

  EMAIL_VERIFICATION: {
    type: "EMAIL_VERIFICATION",
    label: "Potvrda email adrese",
    description:
      "Šalje se nakon registracije kako bi korisnik potvrdio svoju email adresu. Link vrijedi 24 sata.",
    fields: {
      subject: "{{appName}} — potvrda email adrese",
      greeting: "Dobrodošli,",
      bodyText:
        "Hvala što ste se pridružili {{appName}} portalu. Da bismo aktivirali Vaš račun, potvrdite Vašu email adresu klikom na gumb ispod.",
      calloutText: "Link za potvrdu vrijedi 24 sata.",
      closingText:
        "Ako niste otvorili račun u {{appName}}, ignorirajte ovu poruku.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "verifyUrl", description: "Link za potvrdu email adrese.", example: "https://vatrolog.com/verify-email?token=abc123" },
    ],
  },

  ADMIN_ONBOARDING: {
    type: "ADMIN_ONBOARDING",
    label: "Pozivnica adminu (aktivacija tvrtke)",
    description:
      "Šalje se nakon odobrenja zahtjeva za probni pristup. Sadrži šifru servisa, popis kreiranih korisničkih računa i CTA za postavljanje lozinki.",
    fields: {
      subject: "{{appName}} — aktivacija pristupa za {{companyName}}",
      greeting: "Pozdrav,",
      bodyText:
        "Vaša tvrtka <strong>{{companyName}}</strong> registrirana je na <strong>{{appName}}</strong> portalu. {{appName}} je SaaS platforma za upravljanje servisom vatrogasnih aparata — vodi evidenciju aparata, generira radne naloge, planira preglede, šalje obavijesti kupcima i priprema dokumentaciju za inspekciju.",
      calloutText:
        "Klikom na link ispod postavljate vlastitu admin lozinku te odmah lozinke za sve korisnike svoje tvrtke. Link vrijedi 7 dana.",
      closingText:
        "Ako link istekne ili imate pitanja, slobodno odgovorite na ovaj e-mail — pomoći ćemo Vam u svakom koraku.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke koja se aktivira.", example: "Vatrospas d.o.o." },
      { name: "serviceCode", description: "Šifra servisa (kratka identifikacija tvrtke).", example: "26-01" },
      { name: "usernamesText", description: "Popis pristupnih računa (jedan po retku).", example: "26-01-adm — admin" },
      { name: "acceptUrl", description: "Link za postavljanje lozinki.", example: "https://vatrolog.com/auth/accept?token=abc123" },
    ],
  },

  SUBACCOUNT_SETUP: {
    type: "SUBACCOUNT_SETUP",
    label: "Novi sub-račun (postavi lozinku)",
    description:
      "Šalje se adminu tvrtke kad se kreira novi user/workshop račun. Admin treba postaviti lozinku za novog korisnika.",
    fields: {
      subject: "{{appName}} — postavi lozinku za {{username}}",
      greeting: "Pozdrav,",
      bodyText:
        "U <strong>{{appName}}</strong> portalu kreiran je novi korisnički račun za Vašu tvrtku <strong>{{companyName}}</strong>.",
      calloutText:
        "Da biste se mogli prijaviti na novi račun, postavite mu lozinku. Morate biti prijavljeni kao admin iste tvrtke. Link vrijedi 7 dana.",
      closingText:
        "Ako Vam treba pomoć ili link istekne, slobodno odgovorite na ovaj e-mail.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke.", example: "Vatrospas d.o.o." },
      { name: "username", description: "Novi korisnički račun (npr. 26-01-usr1).", example: "26-01-usr1" },
      { name: "setupUrl", description: "Link za postavljanje lozinke.", example: "https://vatrolog.com/auth/setup?token=abc123" },
    ],
  },

  REGISTRATION_REQUEST_RECEIVED: {
    type: "REGISTRATION_REQUEST_RECEIVED",
    label: "Zahtjev za probni pristup zaprimljen",
    description:
      "Potvrdni mail podnositelju zahtjeva za probni pristup. Bez CTA gumba — samo informacija da je zahtjev zaprimljen.",
    fields: {
      subject: "{{appName}} — zahtjev za probni pristup zaprimljen",
      greeting: "{{greetingLine}}",
      bodyText:
        "Hvala što ste poslali zahtjev za probni pristup <strong>{{appName}}</strong>-u za subjekt <strong>{{companyName}}</strong>. Pregledat ćemo podatke i javiti se u roku od <strong>1 radnog dana</strong>.",
      calloutText:
        "Ako odobrimo zahtjev, dobit ćete e-mail s pozivnicom putem koje sami postavljate korisnička imena i lozinke za svoju tvrtku te odmah krećete s 30-dnevnim probnim radom.",
      closingText:
        "Ako u međuvremenu imate pitanja, slobodno odgovorite na ovaj e-mail.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke iz zahtjeva.", example: "Vatrospas d.o.o." },
      { name: "greetingLine", description: "Pozdrav s imenom kontakta ili neutralni 'Pozdrav,'.", example: "Pozdrav Marin," },
    ],
  },

  REGISTRATION_REQUEST_REJECTED: {
    type: "REGISTRATION_REQUEST_REJECTED",
    label: "Odbijen zahtjev za probni pristup",
    description:
      "Šalje se podnositelju kad vendor odbije zahtjev. `reasonLine` je već formatiran (sadrži ili razlog ili poziv da se javi).",
    fields: {
      subject: "{{appName}} — povratna informacija o zahtjevu za probni pristup",
      greeting: "{{greetingLine}}",
      bodyText:
        "Hvala na interesu za <strong>{{appName}}</strong>. Nažalost, zahtjev za probni pristup za subjekt <strong>{{companyName}}</strong> ovaj put ne možemo odobriti.",
      calloutText: "{{reasonLine}}",
      closingText:
        "Ako se okolnosti promijene, slobodno se ponovno javite — rado ćemo razgovarati.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke iz zahtjeva.", example: "Vatrospas d.o.o." },
      { name: "greetingLine", description: "Pozdrav s imenom ili 'Pozdrav,'.", example: "Pozdrav Marin," },
      { name: "reasonLine", description: "Razlog odbijanja (ili pozivnica na razgovor).", example: "Razlog: Zahtjev sadrži nepotpune podatke o tvrtki." },
    ],
  },

  REGISTRATION_REQUEST_VENDOR_ALERT: {
    type: "REGISTRATION_REQUEST_VENDOR_ALERT",
    label: "Vendor alert: novi zahtjev",
    description:
      "Interna obavijest vendoru / podršci da je stigao novi zahtjev za probni pristup. Sadrži meta tablicu i CTA na detalj.",
    fields: {
      subject: "[{{appName}}] Novi zahtjev za probni pristup — {{companyName}}",
      greeting: "Novi zahtjev čeka pregled u platformi.",
      bodyText: "",
      calloutText: "Otvorite detalje zahtjeva klikom na gumb ispod.",
      closingText: "",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke iz zahtjeva.", example: "Vatrospas d.o.o." },
      { name: "oib", description: "OIB tvrtke.", example: "12345678901" },
      { name: "city", description: "Grad sjedišta.", example: "Split" },
      { name: "contactEmail", description: "Email iz zahtjeva.", example: "marin@vatrospas.hr" },
      { name: "contactPhone", description: "Telefon iz zahtjeva (opcionalno).", example: "+385 91 234 5678" },
      { name: "reviewUrl", description: "Direktni link na detalj zahtjeva u platformi.", example: "https://vatrolog.com/platform/registration-requests/abc" },
    ],
  },

  SUBSCRIPTION_EXPIRING: {
    type: "SUBSCRIPTION_EXPIRING",
    label: "Pretplata uskoro ističe",
    description:
      "Šalje se adminu tvrtke kad pretplata ističe za N dana. Sadrži CTA gumb na billing stranicu.",
    fields: {
      subject: "{{appName}} — pretplata ističe za {{daysLeft}} dana",
      greeting: "Poštovani,",
      bodyText:
        "Vaša <strong>{{appName}}</strong> pretplata za tvrtku <strong>{{companyName}}</strong> ističe za <strong>{{daysLeft}} dana</strong>.",
      calloutText:
        "Da biste izbjegli prekid korištenja, obnovite pretplatu prije isteka.",
      closingText:
        "Ako Vam treba pomoć oko obnove ili imate dodatnih pitanja, slobodno odgovorite na ovaj e-mail.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "companyName", description: "Naziv tvrtke.", example: "Vatrospas d.o.o." },
      { name: "daysLeft", description: "Broj dana do isteka pretplate.", example: "7" },
      { name: "billingUrl", description: "Link na billing/obnovu pretplate.", example: "https://vatrolog.com/billing" },
    ],
  },

  OWNER_PORTAL_INVITE: {
    type: "OWNER_PORTAL_INVITE",
    label: "Pozivnica vlasniku (Korisnički portal)",
    description:
      "Šalje se vlasniku vatrogasnih aparata kad ga serviser pozove na Korisnički portal. Sadrži ime servisera koji poziva i CTA za postavljanje lozinke (link vrijedi 14 dana).",
    fields: {
      subject: "{{appName}} — pozivnica na Korisnički portal",
      greeting: "Pozdrav,",
      bodyText:
        "Servis <strong>{{servicerName}}</strong> poziva Vas (<strong>{{customerName}}</strong>) na <strong>{{appName}}</strong> Korisnički portal. U portalu na jednom mjestu vidite svoje vatrogasne aparate, servisne naloge i dokumente te vodite evidenciju redovnih pregleda.",
      calloutText:
        "Klikom na gumb ispod postavljate lozinku i aktivirate svoj pristup. Link vrijedi 14 dana.",
      closingText:
        "Ako niste očekivali ovu pozivnicu, slobodno ignorirajte ovu poruku.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "servicerName", description: "Naziv servisa koji šalje pozivnicu.", example: "Vatrospas d.o.o." },
      { name: "customerName", description: "Naziv kupca/vlasnika kojem se šalje.", example: "Konzum d.d." },
      { name: "acceptUrl", description: "Link za postavljanje lozinke i aktivaciju portala.", example: "https://vatrolog.com/korisnik/invite/abc123" },
    ],
  },

  OWNER_PORTAL_NEW_SERVICER: {
    type: "OWNER_PORTAL_NEW_SERVICER",
    label: "Novi servis dodan u portal (vlasnik)",
    description:
      "Obavještava vlasnika da je novi servis podijelio svoje aparate pa se sada vide u Korisničkom portalu.",
    fields: {
      subject: "{{appName}} — novi servis u vašem portalu",
      greeting: "Pozdrav,",
      bodyText:
        "Servis <strong>{{servicerName}}</strong> dodao je svoje aparate u vaš <strong>{{appName}}</strong> Korisnički portal. Sada na jednom mjestu vidite i aparate koje servisira ovaj servis.",
      calloutText: "Otvorite portal da pregledate sve svoje aparate i naloge.",
      closingText: "Ako mislite da je ovo pogreška, obratite se servisu koji vas je dodao.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "servicerName", description: "Naziv servisa koji je podijelio aparate.", example: "Vatrospas Split d.o.o." },
      { name: "portalUrl", description: "Link na Korisnički portal.", example: "https://vatrolog.com/korisnik" },
    ],
  },

  OWNER_PORTAL_ACCESS_REQUEST: {
    type: "OWNER_PORTAL_ACCESS_REQUEST",
    label: "Zahtjev vlasnika za pristup aparatima (serviser)",
    description:
      "Šalje se serviseru kad vlasnik u Korisničkom portalu zatraži da vidi i aparate koje servisira taj servis. Serviser zahtjev odobrava na detalju kupca.",
    fields: {
      subject: "{{appName}} — vlasnik traži pristup aparatima u portalu",
      greeting: "Pozdrav,",
      bodyText:
        "Vlasnik <strong>{{ownerName}}</strong> ({{ownerEmail}}) zatražio je da u svom <strong>{{appName}}</strong> Korisničkom portalu vidi i aparate koje vaš servis servisira za kupca <strong>{{customerName}}</strong>.",
      calloutText:
        "Zahtjev odobravate (ili odbijate) na detalju kupca u aplikaciji. Tek nakon vašeg odobrenja vlasnik vidi te aparate.",
      closingText:
        "Ako ne želite dijeliti svoje podatke s vlasnikom, jednostavno odbijte zahtjev.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "ownerName", description: "Ime/naziv vlasnika koji traži pristup.", example: "Konzum d.d." },
      { name: "ownerEmail", description: "E-mail vlasnika.", example: "vlasnik@konzum.hr" },
      { name: "customerName", description: "Naziv kupca kod ovog servisa.", example: "Konzum — poslovnica Split" },
      { name: "reviewUrl", description: "Link na detalj kupca gdje se zahtjev odobrava.", example: "https://vatrolog.com/customers/abc123" },
    ],
  },

  OWNER_INSPECTION_REMINDER: {
    type: "OWNER_INSPECTION_REMINDER",
    label: "Podsjetnik na redovni pregled (vlasnik)",
    description:
      "Mjesečni podsjetnik vlasniku da određen broj aparata treba redovni (tromjesečni) pregled. Sadrži CTA na portal.",
    fields: {
      subject: "{{appName}} — vrijeme je za redovni pregled aparata",
      greeting: "Pozdrav,",
      bodyText:
        "U vašem <strong>{{appName}}</strong> Korisničkom portalu <strong>{{dueCount}}</strong> {{dueLabel}} redovni (tromjesečni) pregled koji obavlja vlasnik aparata.",
      calloutText:
        "Redovni pregled možete unijeti izravno u portalu — ručno ili skeniranjem QR koda na aparatu.",
      closingText:
        "Uočene nedostatke potrebno je odmah otkloniti, samostalno ili uz pomoć ovlaštenog servisa.",
      footerNote: null,
    },
    variables: [
      { name: "appName", description: "Naziv platforme.", example: "VatroLog" },
      { name: "dueCount", description: "Broj aparata koji trebaju redovni pregled.", example: "5" },
      { name: "dueLabel", description: "Sklonidba uz broj (aparat treba / aparata treba).", example: "aparata treba" },
      { name: "portalUrl", description: "Link na redovne preglede u portalu.", example: "https://vatrolog.com/korisnik/pregledi" },
    ],
  },
};

export function isVendorTemplateType(value: string): value is VendorTemplateType {
  return (VENDOR_TEMPLATE_TYPES as readonly string[]).includes(value);
}

/**
 * Spojeni rezultat (default + override) za jedan tip.
 * `override === null` znači da nema reda u bazi (koristi se default).
 */
export type ResolvedVendorTemplate = {
  def: VendorTemplateDef;
  fields: VendorTemplateFields;
  override: {
    id: string;
    updatedAt: Date;
    updatedBy: string | null;
  } | null;
};

export async function resolveVendorTemplate(type: VendorTemplateType): Promise<ResolvedVendorTemplate> {
  const def = VENDOR_TEMPLATE_DEFAULTS[type];
  const row = await prisma.platformEmailTemplate.findUnique({ where: { type } });

  if (!row) {
    return { def, fields: { ...def.fields }, override: null };
  }

  return {
    def,
    fields: {
      subject: row.subject,
      greeting: row.greeting,
      bodyText: row.bodyText,
      calloutText: row.calloutText,
      closingText: row.closingText,
      footerNote: row.footerNote,
    },
    override: { id: row.id, updatedAt: row.updatedAt, updatedBy: row.updatedBy },
  };
}

export async function resolveAllVendorTemplates(): Promise<ResolvedVendorTemplate[]> {
  const rows = await prisma.platformEmailTemplate.findMany();
  const byType = new Map(rows.map((r) => [r.type, r]));

  return VENDOR_TEMPLATE_TYPES.map((type) => {
    const def = VENDOR_TEMPLATE_DEFAULTS[type];
    const row = byType.get(type);
    if (!row) return { def, fields: { ...def.fields }, override: null };
    return {
      def,
      fields: {
        subject: row.subject,
        greeting: row.greeting,
        bodyText: row.bodyText,
        calloutText: row.calloutText,
        closingText: row.closingText,
        footerNote: row.footerNote,
      },
      override: { id: row.id, updatedAt: row.updatedAt, updatedBy: row.updatedBy },
    };
  });
}

/** Sample varijable za live preview i test mail. */
export function sampleVarsFor(type: VendorTemplateType): Record<string, string> {
  const def = VENDOR_TEMPLATE_DEFAULTS[type];
  return Object.fromEntries(def.variables.map((v) => [v.name, v.example]));
}

/* =======================
   RENDER (sa supstitucijom + extraHtml po tipu)
======================= */

export type VendorRenderInput = {
  type: VendorTemplateType;
  vars: Record<string, string>;
  branding: EmailBranding;
  /**
   * Opcionalno: već-resolvirani fields (npr. iz `previewWithFields` flow-a).
   * Ako se ne pošalje, povlači se iz baze + defaulta.
   */
  fieldsOverride?: VendorTemplateFields;
};

/**
 * Glavni renderer za vendor mailove. Vraća `{ subject, html, text }` sa svim
 * placeholderima zamijenjenim i extra strukturnim elementima (gumb, šifra,
 * tablica, popis) složenim prema tipu.
 */
export async function renderVendorTemplate(input: VendorRenderInput): Promise<RenderedEmail> {
  const fields = input.fieldsOverride ?? (await resolveVendorTemplate(input.type)).fields;
  const vars = input.vars;

  const fieldsResolved: VendorTemplateFields = {
    subject: substitute(fields.subject, vars, false),
    greeting: substitute(fields.greeting, vars, true),
    bodyText: substitute(fields.bodyText, vars, true),
    calloutText: substitute(fields.calloutText, vars, true),
    closingText: substitute(fields.closingText, vars, true),
    footerNote: fields.footerNote ? substitute(fields.footerNote, vars, false) : null,
  };

  const extraHtml = buildExtraHtml(input.type, vars, input.branding);

  return renderEmailShell({
    subject: fieldsResolved.subject,
    fields: {
      greeting: fieldsResolved.greeting,
      bodyText: fieldsResolved.bodyText,
      calloutText: fieldsResolved.calloutText,
      closingText: fieldsResolved.closingText,
      footerNote: fieldsResolved.footerNote,
    },
    branding: input.branding,
    extraHtml,
  });
}

/** Zamijeni `{{name}}` izraze; preserve-aj inline HTML kad `htmlSafe=true`. */
function substitute(template: string, vars: Record<string, string>, htmlSafe: boolean): string {
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, name: string) => {
    const raw = vars[name] ?? "";
    return htmlSafe ? escapeHtml(raw) : raw;
  });
}

/**
 * Strukturni elementi koji se ne uređuju kroz polja (gumb, šifra, popis,
 * meta tablica). Dodaju se ispod `bodyText`-a a iznad `calloutText`-a.
 */
function buildExtraHtml(
  type: VendorTemplateType,
  vars: Record<string, string>,
  branding: EmailBranding,
): string {
  switch (type) {
    case "PASSWORD_RESET":
      return (
        emailButton({ href: vars.resetUrl ?? "#", label: "Postavi novu lozinku", brandColor: branding.brandColor }) +
        urlFallback(vars.resetUrl ?? "")
      );

    case "EMAIL_VERIFICATION":
      return (
        emailButton({ href: vars.verifyUrl ?? "#", label: "Potvrdi email adresu", brandColor: branding.brandColor }) +
        urlFallback(vars.verifyUrl ?? "")
      );

    case "ADMIN_ONBOARDING": {
      const code = vars.serviceCode
        ? `<div style="margin:8px 0 14px 0;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:4px;">Šifra servisa</div>${emailCodeBlock(vars.serviceCode, branding.brandColor)}</div>`
        : "";
      const usernamesHtml = vars.usernamesText
        ? `<div style="margin:0 0 14px 0;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:6px;">Pristupni računi</div><pre style="margin:0;padding:12px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#0f172a;white-space:pre-wrap;">${escapeHtml(vars.usernamesText)}</pre></div>`
        : "";
      const cta = emailButton({ href: vars.acceptUrl ?? "#", label: "Aktiviraj pristup", brandColor: branding.brandColor });
      return code + usernamesHtml + cta + urlFallback(vars.acceptUrl ?? "");
    }

    case "SUBACCOUNT_SETUP": {
      const code = vars.username
        ? `<div style="margin:8px 0 14px 0;"><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:4px;">Novi račun</div>${emailCodeBlock(vars.username, branding.brandColor)}</div>`
        : "";
      const cta = emailButton({ href: vars.setupUrl ?? "#", label: "Postavi lozinku", brandColor: branding.brandColor });
      return code + cta + urlFallback(vars.setupUrl ?? "");
    }

    case "REGISTRATION_REQUEST_VENDOR_ALERT": {
      const rows: Array<{ label: string; value: string; mono?: boolean }> = [
        { label: "Tvrtka", value: escapeHtml(vars.companyName ?? "") },
        { label: "OIB", value: escapeHtml(vars.oib ?? ""), mono: true },
        { label: "Grad", value: escapeHtml(vars.city ?? "") },
        { label: "Email", value: escapeHtml(vars.contactEmail ?? "") },
      ];
      if (vars.contactPhone) rows.push({ label: "Telefon", value: escapeHtml(vars.contactPhone) });
      const meta = emailKeyValueRows(rows);
      const cta = emailButton({ href: vars.reviewUrl ?? "#", label: "Otvori detalje", brandColor: branding.brandColor });
      return meta + cta;
    }

    case "SUBSCRIPTION_EXPIRING":
      return (
        emailButton({ href: vars.billingUrl ?? "#", label: "Obnovi pretplatu", brandColor: branding.brandColor }) +
        urlFallback(vars.billingUrl ?? "")
      );

    case "OWNER_PORTAL_INVITE":
      return (
        emailButton({ href: vars.acceptUrl ?? "#", label: "Aktiviraj pristup", brandColor: branding.brandColor }) +
        urlFallback(vars.acceptUrl ?? "")
      );

    case "OWNER_PORTAL_NEW_SERVICER":
      return (
        emailButton({ href: vars.portalUrl ?? "#", label: "Otvori portal", brandColor: branding.brandColor }) +
        urlFallback(vars.portalUrl ?? "")
      );

    case "OWNER_PORTAL_ACCESS_REQUEST":
      return (
        emailButton({ href: vars.reviewUrl ?? "#", label: "Otvori i odobri", brandColor: branding.brandColor }) +
        urlFallback(vars.reviewUrl ?? "")
      );

    case "OWNER_INSPECTION_REMINDER":
      return (
        emailButton({ href: vars.portalUrl ?? "#", label: "Unesi redovni pregled", brandColor: branding.brandColor }) +
        urlFallback(vars.portalUrl ?? "")
      );

    case "REGISTRATION_REQUEST_RECEIVED":
    case "REGISTRATION_REQUEST_REJECTED":
      return "";

    default: {
      const _exhaustive: never = type;
      void _exhaustive;
      return "";
    }
  }
}

/** Pomoćni "Ili otvorite ovaj link u pregledniku" tekst (ispod gumba). */
function urlFallback(url: string): string {
  if (!url) return "";
  return (
    `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#64748b;margin:0 0 14px 0;line-height:1.55;">` +
    `Ako gumb ne radi, otvorite ovaj link u pregledniku:<br/>` +
    `<a href="${escapeHtml(url)}" style="color:#475569;word-break:break-all;">${escapeHtml(url)}</a>` +
    `</p>`
  );
}
