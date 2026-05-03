import { z } from "zod";
import { emailSchema, oibSchema, phoneSchema, shortText } from "./common";

export const loginSchema = z.object({
  username: z.string().trim().min(2, "Unesite korisničko ime."),
  password: z.string().min(6, "Lozinka mora imati minimalno 6 znakova."),
});

export const registerSchema = z.object({
  companyName: shortText(200),
  oib: oibSchema,
  address: shortText(300),
  city: shortText(100),
  email: emailSchema,
  phone: phoneSchema,
  adminUsername: z.string().trim().min(3, "Korisničko ime mora imati minimalno 3 znaka.").max(50),
  adminPassword: z.string().min(8, "Lozinka mora imati minimalno 8 znakova.").max(100),
  acceptTerms: z.literal("on").or(z.literal(true)),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8, "Lozinka mora imati minimalno 8 znakova.").max(100),
});

export const pinSchema = z
  .string()
  .trim()
  .regex(/^\d{4,6}$/u, "PIN mora imati 4 do 6 znamenki.");

export const servicerActivateSchema = z.object({
  servicerId: z.string().min(1, "Odaberite servisera."),
  pin: pinSchema,
});
