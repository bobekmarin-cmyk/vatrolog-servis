import { IconSparkles } from "./icons";

export default function TestingBanner() {
  return (
    <div className="relative isolate w-full bg-gradient-to-r from-red-600 via-red-600 to-orange-600 text-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-1 px-4 py-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:text-sm">
        <div className="flex items-center gap-2">
          <IconSparkles className="h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">Proizvod je u izradi i testiranju.</strong>{" "}
            <span className="opacity-90">Tražimo beta-korisnike i povratne informacije.</span>
          </span>
        </div>
        <a
          href="#kontakt"
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25"
        >
          Javi se <span aria-hidden>→</span>
        </a>
      </div>
    </div>
  );
}
