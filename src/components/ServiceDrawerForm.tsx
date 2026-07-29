"use client";

import InternalInspectionSection from "@/components/InternalInspectionSection";
import ServiceFormWithScrap from "@/components/ServiceFormWithScrap";
import ServicerPickerGrid from "@/components/ServicerPickerGrid";
import WorkOrderCustomServicesPicker from "@/components/WorkOrderCustomServicesPicker";
import WorkOrderPartsPicker from "@/components/WorkOrderPartsPicker";
import type { RefObject } from "react";
import type { ServiceFormPayload } from "@/lib/serviceFormData";

function InfoDot({ text }: { text: string }) {
  return (
    <button
      type="button"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-[10px] font-bold leading-none text-slate-600 hover:bg-slate-100"
      title={text}
      aria-label={text}
    >
      i
    </button>
  );
}

/**
 * Forma „Servisiraj aparat” unutar drawera naloga — kompaktan layout
 * (naljepnica / serviser / lokacija u jednom redu) da se manje skrola.
 */
export default function ServiceDrawerForm({
  data,
  formId,
  focusRef,
  onSuccess,
  onCancel,
  onSubmittingChange,
  onScrapModeChange,
}: {
  data: ServiceFormPayload;
  formId: string;
  focusRef?: RefObject<HTMLInputElement | null>;
  onSuccess: () => void;
  onCancel: () => void;
  onSubmittingChange: (submitting: boolean) => void;
  onScrapModeChange: (scrap: boolean) => void;
}) {
  return (
    <ServiceFormWithScrap
      embedded
      formId={formId}
      onSuccess={onSuccess}
      onCancel={onCancel}
      onSubmittingChange={onSubmittingChange}
      onScrapModeChange={onScrapModeChange}
      action={`/api/work-orders/${data.orderId}/items/${data.itemId}/service`}
      resetAction={`/api/work-orders/${data.orderId}/items/${data.itemId}/reset`}
      canReset={data.canReset}
      workOrderId={data.orderId}
      extinguisherSummaryLeft={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {data.serialNumber}/{data.productionYear}
            </div>
            <div className="mt-0.5 text-sm text-slate-700">
              <span className="font-bold text-slate-900">{data.typeLabel}</span>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-600">{data.manufacturerName}</span>
            </div>
          </div>
          <a
            className="btn btn-outline px-3 py-1 text-xs"
            href={`/extinguishers/${data.extinguisherId}/qr-label`}
            target="_blank"
            rel="noreferrer"
          >
            Ispiši QR naljepnicu
          </a>
        </div>
      }
      labelLeft={
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-5">
          {/* Lijeva polovica: naljepnica + lokacija */}
          <div className="flex min-w-0 flex-col gap-3">
            <div>
              <label className="label flex flex-wrap items-center gap-1.5" htmlFor="labelNumber">
                <span>Broj naljepnice</span>
                <InfoDot text="Naljepnica mora biti jedinstvena kroz cijelu bazu." />
              </label>
              <input
                id="labelNumber"
                name="labelNumber"
                ref={focusRef}
                className="input font-mono"
                defaultValue={data.labelNumber}
                required
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label flex flex-wrap items-center gap-1.5">
                <span>Lokacija</span>
                <InfoDot text="Opcionalna lokacija ili napomena koja se zapisuje na upisniku." />
              </label>
              <input
                name="serviceLocationText"
                className="input"
                defaultValue={data.serviceLocationText}
                autoComplete="off"
              />
            </div>
          </div>

          {/* Desna polovica: odabir servisera (1–N) */}
          <div className="min-w-0">
            <label className="label flex flex-wrap items-center gap-1.5">
              <span>Serviser</span>
              <InfoDot text="Odaberi servisera koji je prijavljen za današnji dan. Neaktivni serviseri su zasivljeni." />
            </label>
            <ServicerPickerGrid
              servicers={data.servicers}
              initialServicerId={data.initialServicerId}
              staleServicerHint={data.staleServicerHint}
              compact
            />
          </div>
        </div>
      }
      internalInspectionLeft={
        <InternalInspectionSection
          compact
          agentCode={data.internalInspection.agentCode}
          manufacturerName={data.internalInspection.manufacturerName}
          productionYear={data.internalInspection.productionYear}
          serviceYear={data.internalInspection.serviceYear}
          existingNextInternalYear={data.internalInspection.existingNextInternalYear}
          defaultInternalDone={data.internalInspection.defaultInternalDone}
          intervalYears={data.internalInspection.intervalYears}
          ruleLabel={data.internalInspection.ruleLabel}
          computedFirstUpYear={data.internalInspection.computedFirstUpYear}
          computedNextIfDone={data.internalInspection.computedNextIfDone}
        />
      }
      rightContent={
        <>
          <WorkOrderPartsPicker
            kind={data.typeLabel}
            parts={data.parts}
            initialSelected={data.initialSelectedParts}
          />
          <div>
            <WorkOrderCustomServicesPicker
              available={data.customServices}
              initialSelectedIds={data.initialSelectedCustomServiceIds}
            />
          </div>
        </>
      }
    />
  );
}
