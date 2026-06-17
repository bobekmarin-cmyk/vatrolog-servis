/**
 * Unit-style provjera numeracije otpremnica (bez baze).
 *   npx ts-node -P tsconfig.seed.json scripts/smoke-delivery-note-number.ts
 */
import {
  buildDeliveryNoteFullNumber,
  resolveDeliveryNotePrefix,
} from "../src/lib/deliveryNoteNumber";
import { zagrebCalendarYear, zagrebTwoDigitYear } from "../src/lib/deliveryNoteZagreb";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const issuedAt = new Date("2026-05-15T12:00:00.000Z");

assert(zagrebCalendarYear(issuedAt) === 2026, "zagreb year");
assert(zagrebTwoDigitYear(issuedAt) === "26", "zagreb yy");

assert(resolveDeliveryNotePrefix({ serviceCode: "4201", deliveryNoteNumberPrefix: null }) === "01", "prefix from serviceCode");
assert(
  resolveDeliveryNotePrefix({ serviceCode: "02", deliveryNoteNumberPrefix: "10" }) === "10",
  "manual prefix",
);

const n1 = buildDeliveryNoteFullNumber({ serviceCode: "02", deliveryNoteNumberPrefix: "10" }, issuedAt, 1);
assert(n1.number === "10-260001", `number seq 1 got ${n1.number}`);

const n42 = buildDeliveryNoteFullNumber({ serviceCode: "02", deliveryNoteNumberPrefix: "10" }, issuedAt, 42);
assert(n42.number === "10-260042", `number seq 42 got ${n42.number}`);

const n9999 = buildDeliveryNoteFullNumber({ serviceCode: "02", deliveryNoteNumberPrefix: "10" }, issuedAt, 9999);
assert(n9999.number === "10-269999", `number seq 9999 got ${n9999.number}`);

console.log("delivery-note numbering smoke OK");
