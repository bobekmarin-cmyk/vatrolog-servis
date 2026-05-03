import Link from "next/link";

type Action = {
  href: string;
  label: string;
  primary?: boolean;
};

/**
 * Generički prazno-stanje blok za liste (kupci, aparati, nalozi, ...).
 * Koristi se kao prijedlog "prvog koraka" za novog tenant-a.
 */
export default function EmptyState({
  icon = "✨",
  title,
  description,
  actions = [],
  hint,
}: {
  icon?: string;
  title: string;
  description?: string;
  actions?: Action[];
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl">
        <span aria-hidden>{icon}</span>
      </div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && (
        <p className="max-w-md text-sm text-slate-600">{description}</p>
      )}
      {actions.length > 0 && (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          {actions.map((a) => (
            <Link
              key={a.href + a.label}
              href={a.href}
              className={
                a.primary
                  ? "btn btn-primary px-4 text-sm"
                  : "btn btn-outline px-4 text-sm"
              }
            >
              {a.label}
            </Link>
          ))}
        </div>
      )}
      {hint && (
        <p className="mt-2 max-w-md text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
