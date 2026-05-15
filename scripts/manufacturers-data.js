/**
 * Centralni popis PUCZ proizvođača i uvoznika (15.4.2024.).
 *
 * Koriste ga svi seedovi:
 *   - scripts/seed-manufacturers.js
 *   - prisma/seed-pucz-manufacturers.ts
 *   - prisma/seed.ts (dev)
 *
 * `sortOrder` slijedi redoslijed iz PUCZ obrasca, u koracima od 10 da bi se
 * između mogli umetnuti budući zapisi bez renumeracije.
 *
 * IV-ER KVC d.o.o. pojavljuje se DVA puta jer je u obrascu naveden i kao
 * proizvođač i kao uvoznik - razlikujemo ih napomenom u zagradi.
 */

const MANUFACTURERS = [
  // Proizvođači (10–80)
  { name: "PASTOR T.V.A. d.o.o.",                              sortOrder: 10 },
  { name: "PASTOR INŽENJERING d.d.",                           sortOrder: 20 },
  { name: "IV-ER KVC d.o.o. (proizvođač)",                     sortOrder: 30 },
  { name: "MG-RIJEKA d.o.o. (PRAVNI SLIJEDNIK DIOXA d.o.o.)",  sortOrder: 40 },
  { name: "M. G. S. GRUPA d.o.o.",                             sortOrder: 50 },
  { name: "ZOP- TEHNOLOŠKE USLUGE d.o.o.",                     sortOrder: 60 },
  { name: "VATROSERVIS d.o.o.",                                sortOrder: 70 },
  { name: "MALA GORSKA RIJEKA d.o.o.",                         sortOrder: 80 },
  // Uvoznici (90–280)
  { name: "ZIEGLER d.o.o.",                                    sortOrder: 90 },
  { name: "ZIS OPREMA d.o.o.",                                 sortOrder: 100 },
  { name: "IV-ER KVC d.o.o. (uvoznik)",                        sortOrder: 110 },
  { name: "VATROMAX K.M.B.",                                   sortOrder: 120 },
  { name: "KLALEDA d.o.o.",                                    sortOrder: 130 },
  { name: "MI-STAR d.o.o.",                                    sortOrder: 140 },
  { name: "LUVETI d.o.o.",                                     sortOrder: 150 },
  { name: "JURING d.o.o.",                                     sortOrder: 160 },
  { name: "PRO MIMATO d.o.o.",                                 sortOrder: 170 },
  { name: "KOTING d.o.o.",                                     sortOrder: 180 },
  { name: "TORNADO VALIDUS d.o.o.",                            sortOrder: 190 },
  { name: "ELKRON d.o.o.",                                     sortOrder: 200 },
  { name: "TDS d.o.o.",                                        sortOrder: 210 },
  { name: "SPERONE TRGOVINA - DUBRAVA d.o.o.",                 sortOrder: 220 },
  { name: "FIRE INSPECT d.o.o.",                               sortOrder: 230 },
  { name: "EUROCERTUS d.o.o.",                                 sortOrder: 240 },
  { name: "LOSTURA d.o.o.",                                    sortOrder: 250 },
  { name: "VATROMEHANIKA – DUBRAVA d.o.o.",                    sortOrder: 260 },
  { name: "EMPRESA VENTA d.o.o.",                              sortOrder: 270 },
  { name: "PREVENTA PLUS d.o.o.",                              sortOrder: 280 },
];

const LABEL_KINDS = ["PERIODIC", "APPARATUS_MASS", "CYLINDER_MASS"];

module.exports = { MANUFACTURERS, LABEL_KINDS };
