import { z } from "zod";
import { emailSchema, oibSchema, optionalShortText, phoneSchema, shortText } from "./common";

export const customerCreateSchema = z.object({
  name: shortText(200),
  shortName: optionalShortText(100),
  oib: oibSchema,
  address: optionalShortText(300),
  street: optionalShortText(300),
  postalCode: optionalShortText(20),
  city: optionalShortText(100),
  contactPerson: optionalShortText(200),
  phone: z.union([phoneSchema, z.literal("").transform(() => undefined)]).optional(),
  email: z.union([emailSchema, z.literal("").transform(() => undefined)]).optional(),
  note: optionalShortText(2000),
});

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  // OIB se ne smije mijenjati — namjerno ga izostavljamo iz updatea
  oib: z.undefined().optional(),
});

export const customerDepartmentSchema = z.object({
  name: shortText(200),
  address: optionalShortText(300),
  contactPerson: optionalShortText(200),
  phone: z.union([phoneSchema, z.literal("").transform(() => undefined)]).optional(),
  email: z.union([emailSchema, z.literal("").transform(() => undefined)]).optional(),
  note: optionalShortText(2000),
});
