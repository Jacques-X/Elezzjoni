/**
 * ============================================================
 * strings.ts — Central copy file for Elezzjoni.mt
 * Edit any UI text here. Changes apply site-wide.
 * ============================================================
 */

export const s = {

  // ── Site ────────────────────────────────────────────────
  site: {
    name: 'elezzjoni.mt',
    title: "Elezzjoni.mt — Portal Elettorali ta' Malta",
    description:
      "Sib, irriċerka, u qabbel il-kandidati elettorali fid-distrett tiegħek. Teknoloġija ċivika newtrali politikament għall-votanti Maltin.",
    tagline: 'Teknoloġija ċivika newtrali politikament għall-votanti Maltin.',
    copyright: (year: number) =>
      `© ${year} Elezzjoni.mt · Teknoloġija ċivika open source · Mhux affiljata ma' ebda partit politiku`,
  },

  // ── Navigation ──────────────────────────────────────────
  nav: {
    home:       'Paġna Prinċipali',
    districts:  'Distretti',
    parties:    'Partiti',
    candidates: 'Kandidati',
    ballot:     'PolzaTiegħi',
    stv:        'Kif taħdem is-STV',
    compare:    'Qabbel',
  },

  // ── Footer ──────────────────────────────────────────────
  footer: {
    explore: 'Esplora',
    about:   'Dwar',
    data:    'Dejta',
    electoralCommission: 'Kummissjoni Elettorali',
    dataNote:
      "Id-dejta tinġabar minn rekords elettorali uffiċjali u pubblikazzjonijiet tal-partiti. Is-sommari ġġenerati mill-AI huma mmarkati b'mod ċar.",
  },

  // ── Home page ────────────────────────────────────────────
  home: {
    heroHeading:       'Tgħarraf dwar il-kandidati',
    heroHeadingAccent: 'tiegħek.',
    heroSubheading:    "Ivvota b'kunfidenza.",
    heroDescription:
      "Paġna newtrali sabiex issir taf aħjar il-partiti u l-kandidati fit-13-il distrett elettorali Malti.",
    ctaBrowse:      'Fittex bid-Distrett',
    ctaAll:         'Il-Kandidati Kollha',

    statDistricts:  'Distretti Elettorali',
    statCandidates: 'Kandidati',
    statParties:    'Partiti',

    quickAccessTitle: 'Aċċess Rapidu',

    card1Title:       'Sib bid-Distrett',
    card1Desc:        "Esplora t-13-il distrett elettorali u ara kull kandidat fil-polza tiegħek.",
    card2Title:       'Esplora l-Partiti',
    card2Desc:        "Ara l-profili tal-partiti, il-lista sħiħa tal-kandidati tagħhom, u filtru bl-affiljazzjoni.",
    card3Title:       'Il-Kandidati Kollha',
    card3Desc:        "Fittex u filtru d-direttorju sħiħ tal-kandidati fl-oqsma kollha tad-distretti.",
    cardCta:          'Esplora',

    partiesTitle: 'Partiti fil-Polza',
  },

  // ── Districts ────────────────────────────────────────────
  districts: {
    noResultsFiltered: 'Ma nstab l-ebda kandidat għall-filtru magħżul.',
    noResultsDistrict: "Ma nstab l-ebda kandidat f'dan id-distrett.",
    metaTitle:   'Distretti — Elezzjoni.mt',
    metaDesc:    "Esplora t-13-il distrett elettorali f'Malta u sib il-kandidati f'żontek.",
    heading:     'Distretti Elettorali',
    subheading:  'Malta hija maqsuma fi 13-il distrett elettorali. Agħżel distrett biex tara l-kandidati kollha.',
    candidates:  'kandidati',
    more:        'oħra',
    viewCta:     'Ara l-kandidati',
    empty:       "L-ebda distrett ma ġie mgħobbi s'issa.",
    districtNum: (n: number) => `Distrett ${n}`,
  },

  // ── Parties ──────────────────────────────────────────────
  parties: {
    metaTitle:  'Partiti — Elezzjoni.mt',
    metaDesc:   "Esplora l-partiti politiċi kollha li jikkontestaw l-elezzjonijiet f'Malta.",
    heading:    'Partiti Politiċi',
    subheading: 'Il-partiti kollha li jikkontestaw l-elezzjoni. Agħżel partit biex tara l-kandidati tagħhom.',
    candidates: 'kandidati',
    viewCta:    'Ara l-lista',
    empty:      "L-ebda partit ma ġie mgħobbi s'issa.",
    fallback:   'Partit',
  },

  // ── Candidates ───────────────────────────────────────────
  candidates: {
    metaTitle:    'Kandidati — Elezzjoni.mt',
    metaDesc:     'Esplora d-direttorju sħiħ tal-kandidati li qed jiġġieldu fit-13-il distrett elettorali Malti.',
    heading:      'Il-Kandidati Kollha',
    found:        (n: number) => `${n} kandidat${n !== 1 ? 'i' : ''} misjub${n !== 1 ? 'a' : ''}`,
    noResults:    'L-ebda kandidat ma jaqbel mal-filtri tiegħek.',
    clearFilters: 'Neħħi l-filtri kollha',
    fallback:     'Kandidat',
  },

  // ── Candidate profile ────────────────────────────────────
  candidateProfile: {
    incumbent:       'Membru Attwali',
    districtLabel:   (n: number) => `Distrett ${n}`,
    stancesTitle:    'Pożizzjonijiet Ewlenin',
    stancesBadge:    'Sommarju AI',
    stancesNote:     "Sommarju ġġenerat mill-AI abbażi ta' dikjarazzjonijiet disponibbli pubblikament. Ivverifika b'mod indipendenti.",
    quotesTitle:     'Kwotazzjonijiet Ewlenin',
    quotesBadge:     'Estratt minn AI',
    quotesNote:      'Estratt minn diskorsi pubbliċi, intervisti, u materjali tal-partit.',
    lastUpdated:     (date: string) => `Aġġornat l-aħħar: ${date}`,
    socialFacebook:  'Facebook',
    socialInstagram: 'Instagram',
    socialWebsite:   'Website',
  },

  // ── Search ───────────────────────────────────────────────
  search: {
    placeholder: 'Fittex kandidati…',
    searching:   'Qed nfittex…',
    noResults:   'Ma nstab l-ebda kandidat.',
  },

  // ── Filters ──────────────────────────────────────────────
  filters: {
    label:        'Filtru:',
    all:          'Kollha',
    allParties:   'Il-partiti kollha',
    allDistricts: 'Id-distretti kollha',
    searchName:   'Fittex bl-isem…',
    districtOpt:  (id: number, name: string) => `Distrett ${id} — ${name}`,
    allTags:      'Suġġetti kollha',
    tagsLabel:    'Suġġetti:',
  },

  // ── Ballot (My Ballot) ───────────────────────────────────
  ballot: {
    heading:     'Il-PolzaTiegħi',
    subheading:  'Arranġa l-kandidati magħżulin skont il-preferenza tiegħek.',
    empty:       "Ma ġiex magħżel l-ebda kandidat s'issa.",
    browseCta:   'Esplora l-kandidati',
    clear:       'Ħassar kollox',
    privacyNote: 'Il-polzatinħażen biss fuq il-browser tiegħek. L-ebda dejta ma tiġi mibgħuta.',
    addTip:      'Agħfas il-⭐ fuq kwalunkwe kandidat biex żżidu hawn.',
    moveUp:      "Mur 'il fuq",
    moveDown:    "Mur 'l isfel",
    remove:      'Neħħi',
  },

  // ── Compare ──────────────────────────────────────────────
  compare: {
    heading:   'Qabbel il-Kandidati',
    metaTitle: 'Qabbel — Elezzjoni.mt',
    vs:        'vs',
    party:     'Partit',
    districts: 'Distretti',
    incumbent: 'Deputat Attwali',
    yes:       'Iva',
    no:        'Le',
    stances:   'Pożizzjonijiet Ewlenin',
    noStances: "L-ebda pożizzjoni rrekordjata.",
    pickBtn:   'Qabbel',
    clearPick: 'Ikkanċella',
    selectMsg: (name: string) => `"${name}" magħżul — agħżel kandidat ieħor biex tqabbel`,
  },

  // ── STV Explainer ────────────────────────────────────────
  stv: {
    metaTitle:  'Kif taħdem is-STV — Elezzjoni.mt',
    heading:    'Kif taħdem is-STV?',
    subheading: "Is-Single Transferable Vote hija s-sistema elettorali użata f'Malta mill-1921. Tippermetti li l-vot tiegħek jittrasferi biex ma jintilifx.",
    next:       'Avvanza →',
    prev:       '← Lura',
    step:       (n: number, total: number) => `Pass ${n} minn ${total}`,
    quota:      (n: number) => `Kwota: ${n}`,
    tryBallot:  'Ipprova l-PolzaTiegħi',
  },

  // ── Postcode Lookup ──────────────────────────────────────
  postcode: {
    heading:     'Sib id-Distrett Tiegħek',
    placeholder: 'eż. SLM 1234',
    button:      'Sib',
    notFound:    'Kodiċi postali mhux magħruf.',
    found:       (d: number) => `Distrett ${d}`,
  },

  // ── Map ──────────────────────────────────────────────────
  map: {
    ariaLabel:   "Mappa interattiva tad-distretti elettorali ta' Malta",
    tapDistrict: 'Agħfas distrett biex tara l-kandidati',
  },

  // ── Ballot Preview ───────────────────────────────────────
  ballotPreview: {
    triggerBtn:  'Ara l-Format tal-Ballotta',
    heading:     'PolzaElettorali',
    instruction: 'Agħti l-ewwel preferenza tiegħek billi tikteb in-numru 1 fil-kaxxa tal-kandidat tiegħek. Kompli bin-numri 2, 3, eċċ.',
    official:    'Użu Uffiċjali Biss',
    note:        'Dan huwa eżempju tal-format tal-polzareali.',
    close:       'Agħlaq',
  },

} as const
