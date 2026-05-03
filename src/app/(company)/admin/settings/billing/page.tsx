import { getSession, getSubscriptionInfo } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PLANS, isStripeEnabled } from "@/lib/billing";
import BillingActions from "./BillingActions";

export const metadata = { title: "Pretplata i naplata" };

export default async function SettingsBillingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: {
      name: true,
      activeUntil: true,
      trialEndsAt: true,
      stripeSubscriptionId: true,
      stripePriceId: true,
    },
  });

  const subInfo = await getSubscriptionInfo(session.companyId);
  const stripeEnabled = isStripeEnabled();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Pretplata i naplata</h2>
        <p className="text-sm text-slate-600">Pregled i upravljanje pretplatom za {company?.name}.</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold">Trenutno stanje</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Status</div>
            <div
              className={`mt-1 text-lg font-semibold ${
                subInfo.status === "active"
                  ? "text-green-700"
                  : subInfo.status === "expired"
                    ? "text-red-700"
                    : "text-orange-700"
              }`}
            >
              {subInfo.status === "active"
                ? "Aktivna"
                : subInfo.status === "expired"
                  ? "Istekla"
                  : "Blokirano"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Vrijedi do</div>
            <div className="mt-1 text-lg font-semibold">
              {company?.activeUntil ? company.activeUntil.toLocaleDateString("hr-HR") : "Neograničeno"}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-xs text-slate-500">Trial</div>
            <div className="mt-1 text-lg font-semibold">
              {company?.trialEndsAt ? `do ${company.trialEndsAt.toLocaleDateString("hr-HR")}` : "—"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold">Planovi</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
              <div className="text-lg font-semibold">{plan.label}</div>
              <div className="mt-2 text-2xl font-bold">
                {plan.priceEurMonthly > 0 ? `${plan.priceEurMonthly} €` : "Dogovorno"}
                {plan.priceEurMonthly > 0 && (
                  <span className="text-sm font-normal text-slate-500">/mj</span>
                )}
              </div>
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-700">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <div className="mt-4">
                {plan.id === "enterprise" ? (
                  <a
                    href="mailto:podrska@vatrolog.hr"
                    className="block w-full rounded-md bg-slate-800 py-2 text-center font-medium text-white hover:bg-slate-900"
                  >
                    Kontaktirajte nas
                  </a>
                ) : (
                  <BillingActions
                    plan={plan.id}
                    stripeEnabled={stripeEnabled}
                    hasSubscription={!!company?.stripeSubscriptionId}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {!stripeEnabled && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-semibold">Ručna naplata</h3>
          <p className="mt-2 text-sm text-slate-700">
            Stripe online naplata trenutno nije aktivna za Vaš račun. Za obnovu pretplate kontaktirajte nas:
          </p>
          <ul className="ml-5 mt-2 list-disc text-sm text-slate-700">
            <li>
              Email:{" "}
              <a href="mailto:podrska@vatrolog.hr" className="text-red-600 hover:underline">
                podrska@vatrolog.hr
              </a>
            </li>
            <li>Generirat ćemo Vam predračun i nakon plaćanja aktivirati pretplatu.</li>
          </ul>
        </section>
      )}
    </div>
  );
}
