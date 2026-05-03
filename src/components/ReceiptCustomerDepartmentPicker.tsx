"use client";

import { useEffect, useRef, useState } from "react";
import CustomerPicker from "@/components/CustomerPicker";

type Dept = { id: string; name: string };
type CustomerDTO = {
  id: string;
  name: string;
  shortName?: string | null;
  oib: string;
  address: string;
  contactPerson: string | null;
  phone: string | null;
};

export default function ReceiptCustomerDepartmentPicker({
  defaultCustomer,
  defaultDepartmentId = "",
}: {
  defaultCustomer?: CustomerDTO | null;
  defaultDepartmentId?: string;
}) {
  const [customerId, setCustomerId] = useState<string>(defaultCustomer?.id ?? "");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [loading, setLoading] = useState(false);
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId);
  const [showDeptSelect, setShowDeptSelect] = useState(!defaultDepartmentId);
  const prevCustomerId = useRef(customerId);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!customerId) {
        setDepartments([]);
        setDepartmentId("");
        setShowDeptSelect(true);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/departments/list`);
        const json = await res.json();
        if (!alive) return;
        const items = (json.items ?? []) as Dept[];
        setDepartments(items);

        // Ako se kupac promijenio, resetiramo odjeljenje.
        if (prevCustomerId.current !== customerId) {
          setDepartmentId("");
          setShowDeptSelect(true);
        } else {
          // Ako imamo default department i postoji u listi, ostavi ga i prikaži "Odabrano".
          const ok = departmentId && items.some((d) => d.id === departmentId);
          if (!ok) {
            setDepartmentId("");
            setShowDeptSelect(true);
          } else {
            setShowDeptSelect(false);
          }
        }
        prevCustomerId.current = customerId;
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [customerId]);

  const needsDept = departments.length > 0;
  const showDeptBlock = Boolean(customerId) && (loading || needsDept);

  return (
    <div className="space-y-3">
      <CustomerPicker
        name="customerId"
        required
        enableQuickCreate
        defaultCustomer={defaultCustomer ?? null}
        onChange={(c) => {
          setCustomerId(c?.id ?? "");
        }}
      />

      <input type="hidden" name="departmentId" value={departmentId} />

      {showDeptBlock ? (
        <div>
          <label className="label">Odjeljenje</label>
          {loading ? (
            <div className="help">Učitavam odjeljenja…</div>
          ) : departmentId && !showDeptSelect ? (
            <div className="rounded-2xl bg-white shadow-sm p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium">
                  {departments.find((d) => d.id === departmentId)?.name ?? "Odjeljenje"}
                </div>
                <span className="badge badge-tight badge-success whitespace-nowrap">✓ Odabrano</span>
              </div>
              <button
                type="button"
                className="mt-2 text-xs underline"
                onClick={() => setShowDeptSelect(true)}
              >
                Promijeni odjeljenje
              </button>
            </div>
          ) : (
            <>
              <select
                name="departmentId_select"
                className="select"
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  if (e.target.value) setShowDeptSelect(false);
                }}
                required
              >
                <option value="">Odaberi odjeljenje…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <p className="help">Kupac ima odjeljenja — odabir je obavezan.</p>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

