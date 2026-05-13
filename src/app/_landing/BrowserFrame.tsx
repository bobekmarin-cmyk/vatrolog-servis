export default function BrowserFrame({
  url = "vatrolog.com",
  children,
  className = "",
}: {
  url?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex-1 truncate rounded-md bg-white px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
          {url}
        </div>
        <div className="ml-2 flex items-center overflow-hidden rounded-md border border-slate-200 text-[10px] font-semibold leading-none text-slate-500">
          <span className="flex h-5 w-7 items-center justify-center border-r border-slate-200">
            —
          </span>
          <span className="flex h-5 w-7 items-center justify-center border-r border-slate-200">
            □
          </span>
          <span className="flex h-5 w-7 items-center justify-center bg-red-500 text-white">
            ×
          </span>
        </div>
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}
