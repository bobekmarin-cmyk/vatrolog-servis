"use client";

import { useState } from "react";

/**
 * Trajno brisanje tvrtke — zahtijeva točan upis naziva.
 */
export default function HardPurgeCompanyForm({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [confirmName, setConfirmName] = useState("");
  const match = confirmName.trim() === companyName;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!match) {
      e.preventDefault();
      return;
    }
    if (
      !window.confirm(
        `TRAJNO obrisati tvrtku "${companyName}" i SVE podatke (nalozi, kupci, aparati, skladište, portali linkovi)? Ovo se NE može poništiti.`,
      )
    ) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={`/api/platform/companies/${companyId}/hard-purge`}
      method="post"
      className="space-y-3"
      onSubmit={onSubmit}
    >
      <p className="text-sm text-slate-600">
        Upiši točan naziv tvrtke da potvrdiš:{" "}
        <span className="font-semibold text-slate-900">{companyName}</span>
      </p>
      <input
        name="confirmName"
        className="input w-full max-w-md"
        placeholder={companyName}
        value={confirmName}
        onChange={(e) => setConfirmName(e.target.value)}
        autoComplete="off"
        required
      />
      <button
        type="submit"
        disabled={!match}
        className="btn h-9 px-4 text-sm bg-red-800 text-white hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Trajno obriši tvrtku
      </button>
    </form>
  );
}
