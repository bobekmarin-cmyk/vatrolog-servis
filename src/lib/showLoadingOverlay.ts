type LoadingOverlayOptions = {
  title: string;
  message?: string;
};

export function showLoadingOverlay({ title, message }: LoadingOverlayOptions): () => void {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-loading-overlay", "true");
  overlay.className =
    "fixed inset-0 z-[9998] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[1px]";
  overlay.innerHTML = `
    <div class="rounded-2xl bg-white px-5 py-4 text-center shadow-2xl ring-1 ring-black/10">
      <div class="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-red-600"></div>
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</div>
      ${message ? `<div class="mt-1 text-xs text-slate-600">${escapeHtml(message)}</div>` : ""}
    </div>
  `;
  document.body.appendChild(overlay);
  return () => overlay.remove();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
