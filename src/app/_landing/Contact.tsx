import Link from "next/link";
import { IconArrowRight, IconMail, IconPhone } from "./icons";

const CONTACT_EMAIL = "info@vatrolog.com";
const CONTACT_PHONE_DISPLAY = "097 612 3983";
const CONTACT_PHONE_TEL = "+385976123983";

export default function Contact() {
  return (
    <section id="kontakt" className="py-20 scroll-mt-24">
      <div className="mx-auto max-w-5xl px-4">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-red-600 to-orange-600 p-10 shadow-xl sm:p-14">
          <div className="grid gap-10 lg:grid-cols-5 lg:items-center">
            <div className="lg:col-span-3">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Zanima te VatroLog? Javi se.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-red-50">
                Razgovor od 15 minuta pokaže ti kako bi točno izgledalo tvoje poslovanje u
                VatroLog-u. U testnom razdoblju smo dostupni za osobnu demonstraciju i
                uvodno postavljanje.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Upit o VatroLog-u")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  <IconMail className="h-5 w-5" />
                  Pošalji e-mail
                  <IconArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold text-white ring-1 ring-white/40 hover:bg-white/10"
                >
                  Zatraži probni pristup
                </Link>
              </div>
            </div>

            <ul className="space-y-4 lg:col-span-2">
              <li className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
                <IconMail className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-red-100">
                    E-mail
                  </div>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="mt-0.5 block text-base font-semibold text-white hover:underline"
                  >
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
                <IconPhone className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />
                <div>
                  <div className="text-xs uppercase tracking-wider text-red-100">
                    Telefon
                  </div>
                  <a
                    href={`tel:${CONTACT_PHONE_TEL}`}
                    className="mt-0.5 block text-base font-semibold text-white hover:underline"
                  >
                    {CONTACT_PHONE_DISPLAY}
                  </a>
                  <p className="mt-1 text-xs text-red-100/90">
                    Radnim danom 9:00 – 17:00. Termin demo poziva dogovaramo i e-mailom u roku 1 radnog dana.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
