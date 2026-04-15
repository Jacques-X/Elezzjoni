/**
 * Malta postcode prefix → electoral district (1–13).
 *
 * Postcode format: XXX NNNN  (e.g. "SLM 1455")
 * Source: Electoral Commission Malta — 2022 district boundaries.
 * Covers all 68 localities on Malta and Gozo.
 */

export const DISTRICT_NAMES: Record<number, string> = {
  1:  'Valletta, Floriana, Ħamrun, Marsa',
  2:  'Birgu, Bormla, Senglea, Żabbar',
  3:  'Żejtun, Marsaskala, Marsaxlokk',
  4:  'Paola, Tarxien, Santa Luċija',
  5:  'Żurrieq, Birżebbuġa, Qrendi',
  6:  'Qormi, Luqa, Siġġiewi',
  7:  'Rabat, Mdina, Dingli, Żebbuġ',
  8:  'Birkirkara, Lija, Balzan, Naxxar',
  9:  'Msida, San Ġwann, Swieqi, Ta\' Xbiex',
  10: 'Sliema, San Ġiljan, Gżira',
  11: 'Mosta, Attard',
  12: 'Mellieħa, Mġarr, San Pawl il-Baħar',
  13: 'Għawdex (Gozo)',
}

const PREFIX_TO_DISTRICT: Record<string, number> = {

  // ── District 1 — Valletta, Floriana, Ħamrun, Marsa, Pietà, Santa Venera ──
  VLT: 1,   // Valletta
  FRN: 1,   // Floriana
  HMR: 1,   // Ħamrun
  MRS: 1,   // Marsa
  PTA: 1,   // Pietà
  SVR: 1,   // Santa Venera
  FDL: 1,   // Fleur-de-Lys

  // ── District 2 — Birgu, Bormla, Senglea, Żabbar, Kalkara, Xgħajra, Fgura ──
  VST: 2,   // Vittoriosa (Birgu)
  ISL: 2,   // L-Isla (Senglea)
  CSP: 2,   // Cospicua (Bormla)
  ZBR: 2,   // Żabbar
  KLK: 2,   // Kalkara
  XGJ: 2,   // Xgħajra
  FGR: 2,   // Fgura

  // ── District 3 — Żejtun, Għaxaq, Marsaskala, Marsaxlokk ──────────────────
  ZTN: 3,   // Żejtun
  GXQ: 3,   // Għaxaq
  MSK: 3,   // Marsaskala
  MXK: 3,   // Marsaxlokk

  // ── District 4 — Paola, Tarxien, Santa Luċija, Gudja ─────────────────────
  PLA: 4,   // Paola (Raħal Ġdid)
  TXN: 4,   // Tarxien
  SLJ: 4,   // Santa Luċija
  GDJ: 4,   // Gudja

  // ── District 5 — Żurrieq, Birżebbuġa, Qrendi, Kirkop, Safi, Imqabba ─────
  ZRQ: 5,   // Żurrieq
  BRZ: 5,   // Birżebbuġa
  QRD: 5,   // Qrendi
  KKP: 5,   // Kirkop
  SFI: 5,   // Safi
  MQB: 5,   // Mqabba / Imqabba

  // ── District 6 — Qormi, Luqa, Siġġiewi ──────────────────────────────────
  QRM: 6,   // Qormi
  LQA: 6,   // Luqa
  SGW: 6,   // Siġġiewi

  // ── District 7 — Rabat, Mdina, Dingli, Żebbuġ (Malta), Mtarfa ───────────
  RBT: 7,   // Rabat (Malta)
  MDN: 7,   // Mdina
  DGL: 7,   // Dingli
  ZBG: 7,   // Żebbuġ (Malta)
  MTF: 7,   // Mtarfa

  // ── District 8 — Birkirkara, Lija, Balzan, Iklin, Naxxar ─────────────────
  BKR: 8,   // Birkirkara
  LJA: 8,   // Lija
  BZN: 8,   // Balzan
  IKL: 8,   // Iklin
  NXR: 8,   // Naxxar

  // ── District 9 — Msida, San Ġwann, Swieqi, Ta' Xbiex, Pembroke ──────────
  MSD: 9,   // Msida
  SGN: 9,   // San Ġwann
  SWQ: 9,   // Swieqi
  TXB: 9,   // Ta' Xbiex
  PBK: 9,   // Pembroke
  GHR: 9,   // Għargħur

  // ── District 10 — Sliema, San Ġiljan, Gżira ──────────────────────────────
  SLM: 10,  // Sliema
  STJ: 10,  // San Ġiljan (St Julian's)
  GZR: 10,  // Gżira
  BCQ: 10,  // Baħar iċ-Ċagħaq

  // ── District 11 — Mosta, Attard ───────────────────────────────────────────
  MST: 11,  // Mosta
  ATD: 11,  // Attard

  // ── District 12 — Mellieħa, Mġarr (Malta), San Pawl il-Baħar ─────────────
  MLH: 12,  // Mellieħa
  MGR: 12,  // Mġarr (Malta)
  SPB: 12,  // San Pawl il-Baħar
  BUG: 12,  // Bugibba (part of San Pawl il-Baħar)

  // ── District 13 — Gozo ────────────────────────────────────────────────────
  VCT: 13,  // Victoria (Rabat, Gozo)
  NDR: 13,  // Nadur
  XRA: 13,  // Xagħra
  XWK: 13,  // Xewkija
  SNN: 13,  // Sannat
  KRM: 13,  // Kerċem
  MNR: 13,  // Munxar
  QLA: 13,  // Qala
  FNT: 13,  // Fontana
  GRB: 13,  // Għarb
  GRS: 13,  // Għasri
  SNL: 13,  // San Lawrenz
  GHJ: 13,  // Għajnsielem
  ZGH: 13,  // Żebbuġ (Gozo)
}

/**
 * Returns the district ID (1–13) for a given Malta postcode, or null if unknown.
 * Accepts: "SLM 1455", "SLM1455", "slm 1455" — all normalised.
 */
export function postcodeToDistrict(postcode: string): number | null {
  const prefix = postcode.trim().toUpperCase().replace(/\s+/g, '').slice(0, 3)
  if (prefix.length < 3) return null
  return PREFIX_TO_DISTRICT[prefix] ?? null
}

/**
 * Returns the district name string for display, or null.
 */
export function districtName(id: number): string | null {
  return DISTRICT_NAMES[id] ?? null
}
