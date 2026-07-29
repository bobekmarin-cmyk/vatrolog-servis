export default function VatroLogLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const classes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };
  // font-bold (700) umjesto extrabold — usklađeno s mail/PDF wordmarkom
  return (
    <span className={`${classes[size]} font-bold tracking-tight`}>
      <span className="text-slate-900">Vatro</span>
      <span className="text-red-700">Log</span>
    </span>
  );
}
