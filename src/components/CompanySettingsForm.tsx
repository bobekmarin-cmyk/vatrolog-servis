"use client";

import { useState, type FormEvent } from "react";
import { useDialog } from "@/components/ui/useDialog";
import { useToast } from "@/components/ui/ToastProvider";

type Props = {
  oib: string;
  name: string;
  street: string;
  city: string;
  postalCode: string;
  iban: string;
  email: string;
  phone: string;
};

export default function CompanySettingsForm(props: Props) {
  const dialog = useDialog();
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fd = new FormData(formEl);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/company/settings/update", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: fd,
      });

      const data = (await res.json().catch(() => null)) as
        | null
        | { error?: string; redirectTo?: string | null; justCompletedSetup?: boolean };
      if (!res.ok) {
        await dialog.alert({
          title: "Spremanje nije uspjelo",
          message: data?.error ?? "Greška pri spremanju postavki.",
          variant: "error",
        });
        return;
      }

      const redirectTo = (data?.redirectTo ?? "").toString().trim();
      if (redirectTo) {
        showToast("Postavke spremljene. Preusmjeravam vas na Dashboard…", "success");
        window.location.href = redirectTo;
        return;
      }

      showToast("Postavke spremljene.", "success");
    } catch {
      await dialog.alert({
        title: "Spremanje nije uspjelo",
        message: "Greška pri spremanju postavki.",
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="w-full" onSubmit={onSubmit}>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10 md:items-start">
        {/* Lijevo — tvrtka i adresa */}
        <div className="min-w-0 space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tvrtka i adresa</h3>

          <fieldset className="space-y-4 border-0 p-0">
            <legend className="sr-only">Podaci o tvrtki (samo čitanje)</legend>
            <div>
              <label className="label">Naziv tvrtke</label>
              <input className="input bg-slate-50 text-slate-700" value={props.name} disabled readOnly />
            </div>
            <div>
              <label className="label">OIB</label>
              <input
                className="input bg-slate-50 text-slate-700 tabular-nums"
                value={props.oib}
                disabled
                readOnly
              />
            </div>
          </fieldset>

          <div className="space-y-4 border-t border-slate-100 pt-5">
            <div>
              <label className="label">Ulica i broj</label>
              <input name="street" className="input" defaultValue={props.street} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Poštanski broj</label>
                <input
                  name="postalCode"
                  className="input tabular-nums"
                  defaultValue={props.postalCode}
                  required
                  maxLength={12}
                  autoComplete="postal-code"
                />
              </div>
              <div className="min-w-0">
                <label className="label">Grad</label>
                <input name="city" className="input" defaultValue={props.city} required autoComplete="address-level2" />
              </div>
            </div>
          </div>
        </div>

        {/* Desno — plaćanje i kontakt */}
        <div className="min-w-0 space-y-5 border-t border-slate-200 pt-8 md:border-t-0 md:border-l md:pt-0 md:pl-10">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plaćanje i kontakt</h3>

          <div className="space-y-4">
            <div>
              <label className="label">
                IBAN <span className="font-normal text-red-600">*</span>
              </label>
              <input
                name="iban"
                className="input font-mono text-sm tracking-wide placeholder:font-sans"
                defaultValue={props.iban}
                required
                placeholder="HR…"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">
                E-mail <span className="font-normal text-red-600">*</span>
              </label>
              <input
                name="email"
                type="email"
                className="input"
                defaultValue={props.email}
                required
                placeholder="npr. info@tvrtka.hr"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">
                Kontakt broj <span className="font-normal text-red-600">*</span>
              </label>
              <input
                name="phone"
                type="tel"
                className="input"
                defaultValue={props.phone}
                required
                placeholder="npr. 091 123 4567"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end border-t border-slate-200 pt-6">
        <button className="btn btn-primary min-w-[7.5rem] px-6" type="submit" disabled={saving}>
          {saving ? "Spremam…" : "Spremi"}
        </button>
      </div>
    </form>
  );
}
