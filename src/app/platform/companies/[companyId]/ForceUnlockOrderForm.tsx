"use client";

import { useRef, useState } from "react";

/**
 * Vendor: prisilno otključavanje zaključanog naloga po broju naloga.
 * Namijenjeno iznimnim slučajevima (npr. nalog s kreiranim/izdanim računom).
 */
export default function ForceUnlockOrderForm({ companyId }: { companyId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [orderNumber, setOrderNumber] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const n = orderNumber.trim();
    if (!n) {
      e.preventDefault();
      return;
    }
    if (!window.confirm(`Prisilno otključati nalog "${n}"? Nalog se samo otključava (naljepnice i skladište se ne diraju). Ako je za nalog izdan račun, uskladite ga ručno u e-računima.`)) {
      e.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      action={`/api/platform/companies/${companyId}/work-orders/force-unlock`}
      method="post"
      className="flex flex-wrap items-end gap-2"
      onSubmit={onSubmit}
    >
      <div>
        <label className="label">Broj naloga</label>
        <input
          name="orderNumber"
          className="input w-48"
          placeholder="npr. 26-07-002"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          required
        />
      </div>
      <button type="submit" className="btn h-9 px-4 text-sm bg-red-700 text-white hover:bg-red-800">
        Prisilno otključaj
      </button>
    </form>
  );
}
