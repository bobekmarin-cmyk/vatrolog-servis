"use client";

type Props = {
  title: string;
  message?: string;
};

export default function LoadingOverlay({ title, message }: Props) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]">
      <div className="rounded-2xl bg-white px-5 py-4 text-center shadow-2xl ring-1 ring-black/10">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600" />
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {message ? <div className="mt-1 text-xs text-slate-600">{message}</div> : null}
      </div>
    </div>
  );
}
