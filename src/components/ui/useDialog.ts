"use client";

import { useContext } from "react";
import { DialogContext, type DialogApi } from "./DialogProvider";

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(
      "useDialog() mora biti pozvan unutar <DialogProvider> stabla. Dodaj provider u root layout.",
    );
  }
  return ctx;
}
