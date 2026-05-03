"use client";

export default function PrintPageButton({ label = "Ispiši" }: { label?: string }) {
  return (
    <button className="btn btn-primary px-4" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}

