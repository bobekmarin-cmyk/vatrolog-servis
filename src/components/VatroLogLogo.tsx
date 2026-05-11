export default function VatroLogLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const classes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };
  return (
    <span className={`${classes[size]} font-extrabold tracking-tight`}>
      <span className="text-slate-900">Vatro</span>
      <span className="text-red-700">Log</span>
    </span>
  );
}
