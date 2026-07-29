/**
 * Instant feedback pri prebacivanju tabova — layout (naslov + tabovi) ostaje,
 * samo sadržaj stranice pokazuje skeleton dok RSC dohvaća podatke.
 */
export default function AdminSettingsLoading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded bg-slate-200" />
        <div className="h-4 w-full max-w-xl rounded bg-slate-100" />
        <div className="h-4 w-64 max-w-full rounded bg-slate-100" />
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 p-4">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="h-10 w-full rounded bg-slate-100" />
        <div className="h-10 w-full rounded bg-slate-100" />
        <div className="h-10 w-72 max-w-full rounded bg-slate-100" />
      </div>
      <div className="space-y-2">
        <div className="h-9 w-full rounded bg-slate-100" />
        <div className="h-9 w-full rounded bg-slate-100" />
        <div className="h-9 w-full rounded bg-slate-100" />
        <div className="h-9 w-80 max-w-full rounded bg-slate-100" />
      </div>
    </div>
  );
}
