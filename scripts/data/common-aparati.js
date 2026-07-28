/**
 * Najčešći tipovi aparata (zajednički katalog) — APARATI.xlsx (bez proizvođača).
 * Pridružuju se SVIM proizvođačima osim PASTOR T.V.A. i KLALEDA.
 *
 * UP: AGE_BASED 14/5/2 (prah).
 */
const AGE_UP = {
  internalRuleMode: "AGE_BASED",
  internalIntervalYears: 4,
  internalOldThresholdYears: 14,
  internalYoungIntervalYears: 5,
  internalOldIntervalYears: 2,
};

const COMMON_APARATI = {
  types: [
    { code: "P1", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 1, capacityUnit: "KG", ...AGE_UP },
    { code: "P2", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 2, capacityUnit: "KG", ...AGE_UP },
    { code: "P3", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 3, capacityUnit: "KG", ...AGE_UP },
    { code: "P6", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 6, capacityUnit: "KG", ...AGE_UP },
    { code: "P9", agentCode: "PRAH", constructionCode: "STORED_PRESSURE", capacity: 9, capacityUnit: "KG", ...AGE_UP },
    { code: "S6", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 6, capacityUnit: "KG", ...AGE_UP },
    { code: "S9", agentCode: "PRAH", constructionCode: "CARTRIDGE", capacity: 9, capacityUnit: "KG", ...AGE_UP },
  ],
};

/** Proizvođači koje NE diramo u ovom uvozu (Pastor TVA već ima svoj set; Klaleda dolazi zasebno). */
const EXCLUDE_MANUFACTURER_NAMES = ["PASTOR T.V.A. d.o.o.", "KLALEDA d.o.o."];

module.exports = { COMMON_APARATI, EXCLUDE_MANUFACTURER_NAMES, AGE_UP };
