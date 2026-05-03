import { z } from "zod";
import { optionalShortText, shortText } from "./common";

export const extinguisherCreateSchema = z.object({
  customerId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  apparatusTypeId: z.string().min(1, "Odaberite tip aparata."),
  serialNumber: shortText(100),
  manufactureYear: z.coerce.number().int().min(1970).max(2100).optional().nullable(),
  note: optionalShortText(1000),
});

export const extinguisherUpdateSchema = extinguisherCreateSchema.partial();
