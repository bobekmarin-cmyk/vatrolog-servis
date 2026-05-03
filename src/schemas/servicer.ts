import { z } from "zod";
import { pinSchema } from "./auth";
import { shortText } from "./common";

export const servicerCreateSchema = z.object({
  fullName: shortText(200),
  pin: pinSchema,
});

export const servicerSetPinSchema = z.object({
  pin: pinSchema,
});
