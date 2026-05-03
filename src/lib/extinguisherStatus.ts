export type ExtStatus = "serviced" | "expired" | "scrapped";

export function resolveExtStatus(isScrapped: boolean, ppExpired: boolean): ExtStatus {
  if (isScrapped) return "scrapped";
  if (ppExpired) return "expired";
  return "serviced";
}
