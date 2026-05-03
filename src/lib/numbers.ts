// src/lib/numbers.ts

function two(n: number) {
  return String(n).padStart(2, "0");
}
function three(n: number) {
  return String(n).padStart(3, "0");
}

export function ymKey(d: Date) {
  // 2026-01
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}`;
}

export function makeOrderNumber(d: Date, seq: number) {
  // 26-01-001
  const yy = String(d.getFullYear()).slice(-2);
  const mm = two(d.getMonth() + 1);
  return `${yy}-${mm}-${three(seq)}`;
}

