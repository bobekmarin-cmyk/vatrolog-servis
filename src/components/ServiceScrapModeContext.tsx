"use client";

import { createContext, useContext } from "react";

export const ServiceScrapModeContext = createContext(false);

export function useServiceScrapMode(): boolean {
  return useContext(ServiceScrapModeContext);
}
