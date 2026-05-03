import { formatDateDdMmYyyy } from "@/lib/dateFormat";

export function calcValidUntil(serviceDate: Date): Date {
  // Pravilo: vrijedi do zadnjeg dana u mjesecu servisa + 1 godina
  // Primjer: 10.01.2026 -> 31.01.2027
  const y = serviceDate.getFullYear();
  const m = serviceDate.getMonth(); // 0-11

  // Zadnji dan ISTOG mjeseca u SLJEDEĆOJ godini:
  // new Date(year+1, month+1, 0) => zadnji dan mjeseca (jer day=0 vrati zadnji dan prethodnog mjeseca)
  const d = new Date(y + 1, m + 1, 0);

  // Postavi na kraj dana radi usporedbe (da ne “istekne” usred dana)
  d.setHours(23, 59, 59, 999);
  return d;
}

export function isStillValid(validUntil: Date, now = new Date()): boolean {
  return now.getTime() <= validUntil.getTime();
}

export function fmtDateHR(d: Date | null): string {
  return formatDateDdMmYyyy(d);
}
