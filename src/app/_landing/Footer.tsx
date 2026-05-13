import Link from "next/link";
import VatroLogLogo from "@/components/VatroLogLogo";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-slate-200 bg-white py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <div className="flex items-center gap-3">
          <VatroLogLogo size="sm" />
          <span className="text-xs text-slate-500">
            © {year} VatroLog. Sva prava pridržana.
          </span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-600">
          <Link href="/legal/terms" className="hover:text-slate-900 hover:underline">
            Uvjeti korištenja
          </Link>
          <Link href="/legal/privacy" className="hover:text-slate-900 hover:underline">
            Privatnost
          </Link>
          <Link href="/legal/dpa" className="hover:text-slate-900 hover:underline">
            DPA
          </Link>
          <Link href="/legal/google-api" className="hover:text-slate-900 hover:underline">
            Gmail integracija
          </Link>
          <Link href="/legal/impressum" className="hover:text-slate-900 hover:underline">
            Impressum
          </Link>
          <Link href="/register" className="hover:text-slate-900 hover:underline">
            Probni pristup
          </Link>
          <Link href="/login" className="hover:text-slate-900 hover:underline">
            Prijava
          </Link>
        </nav>
      </div>
    </footer>
  );
}
