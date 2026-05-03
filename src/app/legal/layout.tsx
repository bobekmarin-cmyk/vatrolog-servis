import VatroLogLogo from "@/components/VatroLogLogo";
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto flex items-center justify-between p-4">
          <Link href="/"><VatroLogLogo size="md" /></Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/legal/terms" className="text-slate-700 hover:text-red-600">Uvjeti</Link>
            <Link href="/legal/privacy" className="text-slate-700 hover:text-red-600">Privatnost</Link>
            <Link href="/legal/dpa" className="text-slate-700 hover:text-red-600">DPA</Link>
            <Link href="/legal/impressum" className="text-slate-700 hover:text-red-600">Impressum</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto py-10 px-4 prose prose-slate">
        {children}
      </main>
    </div>
  );
}
