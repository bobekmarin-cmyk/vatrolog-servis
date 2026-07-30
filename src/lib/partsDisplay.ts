/**
 * Čista pravila prikaza dijelova — bez ijednog dodira s bazom.
 *
 * Odvojeno od `partsCatalog.ts` namjerno: taj modul importa `@/lib/prisma`, pa
 * bi svaki `"use client"` component koji odavde uzme helper povukao Prisma
 * klijent u browser bundle i srušio stranicu u pregledniku.
 *
 * Sve ovdje mora ostati izvedivo i na serveru i u pregledniku.
 */
import type { Prisma, PartUnit } from "@prisma/client";

/**
 * Prikaz mjerne jedinice dijela: KOM → "kom", KG → "kg", L → "L".
 * Koristi se u UI pickeru, otpremnici/PDF-u i tiskanim materijalima.
 *
 * Namjerno uspoređujemo string literale umjesto `PartUnit.KG`: enum kao
 * *vrijednost* bi značio runtime import `@prisma/client` i u pregledniku.
 */
export function formatPartUnit(unit: PartUnit | null | undefined): string {
  switch (unit) {
    case "KG":
      return "kg";
    case "L":
      return "L";
    case "KOM":
    default:
      return "kom";
  }
}

export type PartSourceLabel = "PLATFORM" | "CUSTOM";

/** Minimalni Part oblik koji nam treba za prikaz/snapshotiranje. */
export type PartLite = {
  id: string;
  manufacturerId: string;
  companyId: string | null;
  code: string;
  manufacturerCode: string | null;
  name: string;
  active: boolean;
  /** Opcionalno — potrebno samo za efektivni favorit / brzi izbornik. */
  common?: boolean;
  defaultPrice: Prisma.Decimal | null;
  unit: PartUnit;
};

export type PartOverrideLite = {
  partId: string;
  code: string | null;
  price: Prisma.Decimal | null;
  active: boolean;
  /** null = naslijedi Part.common */
  common: boolean | null;
};

/**
 * Vrati prikaznu šifru dijela:
 *  - vlastiti dio: uvijek `Part.code` (tenantov)
 *  - platform dio s overrideom i ne-praznom šifrom: override šifra
 *  - platform dio s `manufacturerCode`: ta šifra
 *  - platform dio bez šifre proizvođača: prazno (tehnički `code` ostaje u DB)
 */
export function partDisplayCode(part: PartLite, override?: PartOverrideLite | null): string {
  if (part.companyId) return part.code;
  const ov = override?.code?.trim();
  if (ov) return ov;
  const mc = part.manufacturerCode?.trim();
  if (mc) return mc;
  return "";
}

/**
 * Vrati šifru proizvođača (samo za platform dijelove). Za vlastite dijelove
 * vraća null jer ih proizvođač ne vodi pod svojim šiframa.
 * Ako `manufacturerCode` nije unesen, vraća null (ne pada na tehnički `code`).
 */
export function partManufacturerCode(part: PartLite): string | null {
  if (part.companyId) return null;
  const mc = part.manufacturerCode?.trim();
  return mc && mc.length > 0 ? mc : null;
}

/**
 * Efektivna jedinična cijena: tenant override > platform default.
 * Za vlastite dijelove uvijek `Part.defaultPrice`.
 */
export function partEffectivePrice(
  part: PartLite,
  override?: PartOverrideLite | null,
): Prisma.Decimal | null {
  if (!part.companyId && override?.price != null) return override.price;
  return part.defaultPrice ?? null;
}

/**
 * Da li je dio aktivan za tenant katalog (ne uzima u obzir `usePlatformCatalog`
 * toggle proizvođača — to validiraj odvojeno).
 *  - vlastiti: `Part.active`
 *  - platform: `Part.active && (override?.active ?? true)`
 */
export function partActiveForCompany(part: PartLite, override?: PartOverrideLite | null): boolean {
  if (!part.active) return false;
  if (part.companyId) return true;
  return override?.active ?? true;
}

/**
 * Efektivno „uobičajen“ (favorit) za brzi izbornik na upisniku:
 *  - vlastiti dio: `Part.common`
 *  - platform: `CompanyPartOverride.common` ako je postavljen, inače `Part.common`
 */
export function partEffectiveCommon(
  part: Pick<PartLite, "companyId" | "common">,
  override?: Pick<PartOverrideLite, "common"> | null,
): boolean {
  if (part.companyId) return part.common === true;
  if (override?.common != null) return override.common;
  return part.common === true;
}
