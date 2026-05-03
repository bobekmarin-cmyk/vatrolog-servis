export function isActiveToday(activatedAt: Date | null | undefined): boolean {
  if (!activatedAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return activatedAt >= today;
}

export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
