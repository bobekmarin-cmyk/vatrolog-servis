import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";

/**
 * Jedno čitanje `Company` reda po requestu.
 *
 * Prije su isti redak čitale četiri odvojene funkcije (sesija, pretplata,
 * naziv u layoutu, plan) — svaka svojim upitom. Kad krug do baze košta 100+ ms,
 * to su bile stotine milisekundi potrošene na ponovno čitanje istog reda.
 *
 * `cache()` dedupliciranje vrijedi unutar jednog RSC requesta, pa nema rizika
 * od zastarjelih podataka između zahtjeva.
 */
export type CompanyCore = {
  id: string;
  name: string;
  plan: SubscriptionPlan;
  blocked: boolean;
  activeUntil: Date | null;
  deletedAt: Date | null;
};

export const getCompanyCore = cache(async (companyId: string): Promise<CompanyCore | null> => {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      plan: true,
      blocked: true,
      activeUntil: true,
      deletedAt: true,
    },
  });
});
