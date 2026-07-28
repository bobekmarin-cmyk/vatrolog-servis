/**
 * Tipovi aparata — PASTOR T.V.A. d.o.o.
 * Izvor: APARATI.xlsx (List1).
 *
 * UP pravila (unutarnji pregled):
 *  - PRAH (ST + BOČICA) i PJENA: AGE_BASED — do 14 g svakih 5, zatim svake 2
 *  - CO2: FIXED 5 (runtime ionako forsira 5 g za CO2)
 *
 * capacityUnit: PRAH/CO2 → KG, PJENA → L
 */

const PASTOR_AGE_UP = {
  internalRuleMode: "AGE_BASED",
  internalIntervalYears: 4,
  internalOldThresholdYears: 14,
  internalYoungIntervalYears: 5,
  internalOldIntervalYears: 2,
};

const CO2_UP = {
  internalRuleMode: "FIXED",
  internalIntervalYears: 5,
  internalOldThresholdYears: null,
  internalYoungIntervalYears: null,
  internalOldIntervalYears: null,
};

/** @type {{ manufacturerName: string, types: Array<{
 *   code: string,
 *   agentCode: string,
 *   constructionCode: string,
 *   capacity: number,
 *   capacityUnit: "KG"|"L",
 *   internalRuleMode: "FIXED"|"AGE_BASED",
 *   internalIntervalYears: number,
 *   internalOldThresholdYears: number|null,
 *   internalYoungIntervalYears: number|null,
 *   internalOldIntervalYears: number|null,
 * }> }} */
const PASTOR_TVA_APARATI = {
  manufacturerName: "PASTOR T.V.A. d.o.o.",
  types: [
    // Prah — stalni tlak
    { code: "P1", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 1, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P2", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 2, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P3", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 3, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P6", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 6, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P9", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 9, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P50", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 50, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "P100", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 100, capacityUnit: "KG", ...PASTOR_AGE_UP },
    // Prah — bočica
    { code: "S6", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 6, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "S9", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 9, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "S50", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 50, capacityUnit: "KG", ...PASTOR_AGE_UP },
    { code: "S100", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 100, capacityUnit: "KG", ...PASTOR_AGE_UP },
    // CO2
    { code: "CO2-2", agentCode: "CO2", constructionCode: "CO2", capacity: 2, capacityUnit: "KG", ...CO2_UP },
    { code: "CO2-3", agentCode: "CO2", constructionCode: "CO2", capacity: 3, capacityUnit: "KG", ...CO2_UP },
    { code: "CO2-5", agentCode: "CO2", constructionCode: "CO2", capacity: 5, capacityUnit: "KG", ...CO2_UP },
    { code: "CO2-10", agentCode: "CO2", constructionCode: "CO2", capacity: 10, capacityUnit: "KG", ...CO2_UP },
    // Pjena — bočica
    { code: "F6", agentCode: "PJENA", constructionCode: "CARTRIDGE", capacity: 6, capacityUnit: "L", ...PASTOR_AGE_UP },
    { code: "F9", agentCode: "PJENA", constructionCode: "CARTRIDGE", capacity: 9, capacityUnit: "L", ...PASTOR_AGE_UP },
    // Pjena — stalni tlak
    { code: "F6P", agentCode: "PJENA", constructionCode: "STORED_PRESSURE", capacity: 6, capacityUnit: "L", ...PASTOR_AGE_UP },
    { code: "F9P", agentCode: "PJENA", constructionCode: "STORED_PRESSURE", capacity: 9, capacityUnit: "L", ...PASTOR_AGE_UP },
  ],
};

module.exports = { PASTOR_TVA_APARATI, PASTOR_AGE_UP, CO2_UP };
