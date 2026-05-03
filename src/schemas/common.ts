import { z } from "zod";
import { AppValidationError } from "@/lib/apiHandler";

export function isValidCroatianOib(value: string): boolean {
  const oib = value.replace(/\D/g, "");
  if (!/^\d{11}$/u.test(oib)) return false;

  let a = 10;
  for (let i = 0; i < 10; i++) {
    a += Number(oib[i]);
    a %= 10;
    if (a === 0) a = 10;
    a *= 2;
    a %= 11;
  }
  const control = 11 - a;
  const checkDigit = control === 10 ? 0 : control;
  return checkDigit === Number(oib[10]);
}

/** Hrvatski OIB: točno 11 znamenki + kontrolna znamenka. */
export const oibSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/u, "OIB mora imati točno 11 znamenki.")
  .refine(isValidCroatianOib, "OIB nije valjan.");

export const emailSchema = z
  .string()
  .trim()
  .min(3, "Unesite email adresu.")
  .max(200, "Email je predug.")
  .email("Neispravna email adresa.");

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Unesite telefon.")
  .max(40, "Telefon je predug.")
  .regex(/^[0-9+()\-\s/]+$/u, "Telefon sadrži nedozvoljene znakove.");

export const ibanSchema = z
  .string()
  .trim()
  .min(15, "Unesite IBAN.")
  .max(34, "IBAN je predug.")
  .regex(/^[A-Z]{2}\d+$/u, "IBAN mora početi s dvoslovnom oznakom države i sadržavati samo znamenke.");

export const shortText = (maxLen = 200) =>
  z.string().trim().min(1, "Obavezno polje.").max(maxLen, `Najviše ${maxLen} znakova.`);

export const optionalShortText = (maxLen = 200) =>
  z
    .string()
    .trim()
    .max(maxLen, `Najviše ${maxLen} znakova.`)
    .optional()
    .or(z.literal("").transform(() => undefined));

export const longText = (maxLen = 2000) =>
  z.string().trim().max(maxLen, `Najviše ${maxLen} znakova.`);

export const cuidSchema = z.string().min(5).max(60);

export const booleanLike = z.union([z.boolean(), z.literal("true"), z.literal("false")]).transform((v) => {
  if (typeof v === "boolean") return v;
  return v === "true";
});

export const positiveInt = z.coerce
  .number()
  .int("Mora biti cijeli broj.")
  .nonnegative("Ne smije biti negativno.");

export const positiveFloat = z.coerce.number().nonnegative("Ne smije biti negativno.");

export type FieldErrors = Record<string, string>;

/**
 * Pretvori zod error u polje→poruka mapu za FE prikaz.
 */
export function zodFieldErrors(err: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of err.issues) {
    const path = issue.path.join(".");
    if (!out[path]) out[path] = issue.message;
  }
  return out;
}

/**
 * Parse + pretvori u AppValidationError koji apiHandler serializira ispravno.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, message = "Neispravni podaci."): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const fields = zodFieldErrors(result.error);
  throw new AppValidationError(message, fields);
}
