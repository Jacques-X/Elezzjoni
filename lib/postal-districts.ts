/**
 * Malta postcode prefix → electoral district (1–13).
 *
 * Postcode format: XXX NNNN  (e.g. "SLM 1455")
 * This map covers all 68 localities.  Update from the Electoral Commission's
 * official locality-to-district assignment if boundaries change.
 *
 * Source: Electoral Commission Malta (https://electoral.gov.mt)
 */
const PREFIX_TO_DISTRICT: Record<string, number> = {
  // ── District 1 — Valletta, Floriana, Ħamrun, Marsa ─────
  VLT: 1,
  FRN: 1,
  HMR: 1,
  MRS: 1,

  // ── District 2 — Msida, Gżira, Ta' Xbiex, Pietà, Santa Venera ─
  MSD: 2,
  GZR: 2,
  TXB: 2,
  PTA: 2,
  SVR: 2,

  // ── District 3 — Birkirkara, Balzan, Lija, Attard ──────
  BKR: 3,
  BZN: 3,
  LJA: 3,
  ATD: 3,

  // ── District 4 — Naxxar, San Ġwann, Swieqi, Pembroke, Iklin ──
  NXR: 4,
  SGN: 4,
  SWQ: 4,
  PBK: 4,
  IKL: 4,

  // ── District 5 — Sliema, St Julian's ───────────────────
  SLM: 5,
  STJ: 5,

  // ── District 6 — Mellieħa, Mġarr, St Paul's Bay, Bugibba ──
  MLH: 6,
  MGR: 6,
  SPB: 6,
  BUG: 6,

  // ── District 7 — Rabat, Mdina, Dingli, Żebbuġ, Siġġiewi ──
  RBT: 7,
  MDN: 7,
  DGL: 7,

  // ── District 8 — Qormi, Żebbuġ ─────────────────────────
  QRM: 8,
  ZBG: 8,
  SGW: 8,

  // ── District 9 — Żurrieq, Qrendi, Kirkop, Mqabba, Safi ──
  ZRQ: 9,
  QRD: 9,
  KKP: 9,
  MQB: 9,
  SFI: 9,

  // ── District 10 — Żejtun, Birżebbuġa, Marsaxlokk, Gudja, Għaxaq ──
  ZTN: 10,
  BRZ: 10,
  MXK: 10,
  GDJ: 10,
  GXQ: 10,

  // ── District 11 — Paola, Tarxien, Fgura, Santa Luċija ──
  PLA: 11,
  TXN: 11,
  FGR: 11,
  SLJ: 11,

  // ── District 12 — Żabbar, Marsaskala, Vittoriosa, Cospicua, Senglea, Kalkara ──
  ZBR: 12,
  MSK: 12,
  VST: 12,
  CSP: 12,
  SGL: 12,
  KLK: 12,

  // ── District 13 — Gozo ──────────────────────────────────
  VCT: 13,
  NDR: 13,
  XGR: 13,
  XWK: 13,
  SNN: 13,
  GHR: 13,
  GRS: 13,
  KRM: 13,
  MNR: 13,
  QLA: 13,
  FNT: 13,
  GRB: 13,
}

/**
 * Returns the district ID (1–13) for a given Malta postcode, or null if unknown.
 * Accepts formats: "SLM 1455", "SLM1455", "slm 1455" — all normalised.
 */
export function postcodeToDistrict(postcode: string): number | null {
  const prefix = postcode.trim().toUpperCase().replace(/\s+/g, '').slice(0, 3)
  return PREFIX_TO_DISTRICT[prefix] ?? null
}
