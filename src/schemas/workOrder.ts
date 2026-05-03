import { z } from "zod";
import { optionalShortText, positiveFloat, positiveInt } from "./common";

export const workOrderItemFillSchema = z.object({
  servicerId: z.string().min(1, "Odaberite servisera."),
  labelNumber: z.string().trim().min(1, "Unesite broj naljepnice.").max(50),
  notes: optionalShortText(1000),
  serviceDate: z.coerce.date().optional(),
  pressureTestDone: z.coerce.boolean().optional(),
  internalInspection: z.coerce.boolean().optional(),
  parts: z
    .array(
      z.object({
        partId: z.string().min(1),
        quantity: positiveInt.default(1),
        unitPrice: positiveFloat.optional(),
      }),
    )
    .optional(),
});

export const workOrderCreateSchema = z.object({
  customerId: z.string().min(1, "Odaberite kupca."),
  receiptId: z.string().optional(),
  scheduledDate: z.coerce.date().optional(),
  note: optionalShortText(2000),
});
