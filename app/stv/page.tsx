'use client'

import { useState } from 'react'
import Link from 'next/link'
import { s } from '@/lib/strings'

// ── Scenario ────────────────────────────────────────────────────────────────
// 20 voters · 2 seats · 5 candidates
// Quota (Droop) = floor(20 / 3) + 1 = 7
//
// First preferences:
//   Anna  (PL)  : 8    Brian (PN) : 4    Clara (AD) : 3
//   David (PL)  : 3    Eva   (IND): 2
//
// Round 1 — Anna (8) > quota 7 → ELECTED. Surplus = 1.
//   All 8 Anna ballots → Brian 2nd. Transfer value = 1/8.
//   Brian: 4 + 1 = 5
//
// Round 2 — Eva (2) lowest → ELIMINATED. Both her ballots → Clara 2nd.
//   Clara: 3 + 2 = 5
//
// Round 3 — David (3) lowest → ELIMINATED. 2 ballots → Brian, 1 → Clara.
//   Brian: 5 + 2 = 7 → ELECTED ✓   Clara: 5 + 1 = 6

const CANDIDATES = [
  { key: 'Anna',  full: 'Anna Borg',        party: 'PL',  color: '#CF0A2C' },
  { key: 'Brian', full: 'Brian Azzopardi',  party: 'PN',  color: '#003DA5' },
  { key: 'Clara', full: 'Clara Farrugia',   party: 'AD',  color: '#00A651' },
  { key: 'David', full: 'David Camilleri',  party: 'PL',  color: '#D84040' },
  { key: 'Eva',   full: 'Eva Vella',        party: 'IND', color: '#6B7280' },
] as const

type CandidateKey = typeof CANDIDATES[number]['key']

// Three contrasting example ballots — illustrate different voter patterns
const EXAMPLE_BALLOTS: Array<{ label: string; prefs: Record<CandidateKey, number> }> = [
  { label: 'Votant A', prefs: { Anna: 1, Brian: 2, Clara: 3, David: 4, Eva: 5 } },
  { label: 'Votant B', prefs: { Brian: 1, Anna: 2, Clara: 3, David: 4, Eva: 5 } },
  { label: 'Votant C', prefs: { Eva: 1, Clara: 2, Brian: 3, David: 4, Anna: 5 } },
]

interface VoteBar {
  key: CandidateKey
  votes: number
  state: 'active' | 'elected' | 'eliminated'
  delta?: string
}

interface CountStep {
  phase: 'count'
  title: string
  desc: string
  bars: VoteBar[]
  transfer: { from: string; to: string; count: string } | null
  note: string | null
}

interface BallotStep {
  phase: 'ballots'
  title: string
  desc: string
}

type Step = BallotStep | CountStep

const TOTAL  = 20
const SEATS  = 2
const QUOTA  = Math.floor(TOTAL / (SEATS + 1)) + 1   // 7
const MAX_V  = TOTAL                                   // for bar widths

const STEPS: Step[] = [
  // ── 1. How to vote ──────────────────────────────────────────────────────
  {
    phase: 'ballots',
    title: 'Il-Karta tal-Vot — Kif Tavvota',
    desc:
      `F'elezzjoni STV il-votant jikteb in-numri 1, 2, 3 ... ħdejn il-kandidati ` +
      `fl-ordni tal-preferenza tiegħu. "1" huwa l-iktar mixtieq; ma hemmx obbligu ` +
      `timmarkahom kollha. Hawn taħt: 3 eżempji ta' kartas tal-vot b'${CANDIDATES.length} ` +
      `kandidati, żewġ siġġijiet, u ${TOTAL} votanti.`,
  },

  // ── 2. First count ──────────────────────────────────────────────────────
  {
    phase: 'count',
    title: 'Pass 1 — L-Ewwel Preferenzi Jingħoddu',
    desc:
      `In-numri "1" mill-${TOTAL} karta tal-vot jingħoddu. ` +
      `Il-kwota (formula ta' Droop) hija floor(${TOTAL} ÷ ${SEATS + 1}) + 1 = ${QUOTA}. ` +
      `Biex kandidat jiġi elett jeħtieġ jilħaq jew jaqbeż din il-kwota.`,
    bars: [
      { key: 'Anna',  votes: 8, state: 'active' },
      { key: 'Brian', votes: 4, state: 'active' },
      { key: 'Clara', votes: 3, state: 'active' },
      { key: 'David', votes: 3, state: 'active' },
      { key: 'Eva',   votes: 2, state: 'active' },
    ],
    transfer: null,
    note: `Kwota = floor(${TOTAL} ÷ ${SEATS + 1}) + 1 = ${QUOTA} voti`,
  },

  // ── 3. Anna elected ─────────────────────────────────────────────────────
  {
    phase: 'count',
    title: 'Anna Tiġi Eletta! (Siġġu 1 minn 2)',
    desc:
      `Anna għandha 8 voti — iżjed mill-kwota ta' ${QUOTA}. Tiġi eletta! ` +
      `Is-surplus (8 − ${QUOTA} = 1 vot) jittrasferixxu proporzjonalment. ` +
      `Il-valur tat-trasferiment: 1 ÷ 8 = 0.125 kull karta. ` +
      `It-8 kartas ta' Anna kollha kellhom Brian bħala t-tieni preferenza, ` +
      `allura Brian jirċievi 8 × 0.125 = 1.0 vot.`,
    bars: [
      { key: 'Anna',  votes: 8, state: 'elected' },
      { key: 'Brian', votes: 4, state: 'active' },
      { key: 'Clara', votes: 3, state: 'active' },
      { key: 'David', votes: 3, state: 'active' },
      { key: 'Eva',   votes: 2, state: 'active' },
    ],
    transfer: { from: 'Anna', to: 'Brian', count: '1 vot surplus' },
    note: 'Surplus = 8 − 7 = 1  ·  Valur = 1 ÷ 8 = 0.125  ·  8 kartas × 0.125 = 1.0 → Brian',
  },

  // ── 4. Surplus applied, Eva eliminated ──────────────────────────────────
  {
    phase: 'count',
    title: 'Surplus Trasferit — Eva Tiġi Eliminata',
    desc:
      `Brian jirċievi l-vot surplus minn Anna (4 + 1 = 5). Anna tibqa' eletta bil-kwota ta' 7. ` +
      `Ħadd mill-bqija ma laħaq il-kwota. Eva (2 voti) hija l-inqas kandidat — tiġi eliminata. ` +
      `Il-kartas tagħha mhumiex mitlufa: it-tieni preferenza tal-votanti tagħha hija Clara.`,
    bars: [
      { key: 'Anna',  votes: 7, state: 'elected' },
      { key: 'Brian', votes: 5, state: 'active', delta: '+1' },
      { key: 'Clara', votes: 3, state: 'active' },
      { key: 'David', votes: 3, state: 'active' },
      { key: 'Eva',   votes: 2, state: 'eliminated' },
    ],
    transfer: { from: 'Eva', to: 'Clara', count: '2 voti' },
    note: 'Brian: 4 + 1 = 5  ·  Il-2 kartas ta\' Eva: preferenza li jmiss → Clara',
  },

  // ── 5. Eva's votes to Clara, David eliminated ───────────────────────────
  {
    phase: 'count',
    title: 'Voti ta\' Eva jgħaddu lil Clara — David Jiġi Eliminat',
    desc:
      `Clara tirċievi ż-żewġ voti ta' Eva (3 + 2 = 5). ` +
      `Brian (5) u Clara (5) huma ndaqs; David (3) huwa l-inqas — jiġi eliminat. ` +
      `Mill-3 kartas ta' David: 2 kellhom Brian bħala l-preferenza li jmiss, ` +
      `u 1 kellha lil Clara.`,
    bars: [
      { key: 'Anna',  votes: 7, state: 'elected' },
      { key: 'Brian', votes: 5, state: 'active' },
      { key: 'Clara', votes: 5, state: 'active', delta: '+2' },
      { key: 'David', votes: 3, state: 'eliminated' },
      { key: 'Eva',   votes: 0, state: 'eliminated' },
    ],
    transfer: { from: 'David', to: 'Brian u Clara', count: '3 voti' },
    note: 'Clara: 3 + 2 = 5  ·  2 kartas ta\' David → Brian  ·  1 karta ta\' David → Clara',
  },

  // ── 6. Brian elected ────────────────────────────────────────────────────
  {
    phase: 'count',
    title: 'Brian Jiġi Elett! (Siġġu 2 minn 2)',
    desc:
      `Brian jirċievi ż-żewġ voti ta' David (5 + 2 = 7) u jilħaq eżattament il-kwota — jiġi elett! ` +
      `Clara tirċievi l-vot l-ieħor (5 + 1 = 6). It-tieni siġġu jimtela u l-kontaġġ jispiċċa.`,
    bars: [
      { key: 'Anna',  votes: 7, state: 'elected' },
      { key: 'Brian', votes: 7, state: 'elected', delta: '+2' },
      { key: 'Clara', votes: 6, state: 'active',  delta: '+1' },
      { key: 'David', votes: 0, state: 'eliminated' },
      { key: 'Eva',   votes: 0, state: 'eliminated' },
    ],
    transfer: null,
    note: 'Brian: 5 + 2 = 7 ✓ (elett)  ·  Clara: 5 + 1 = 6',
  },

  // ── 7. Final summary ────────────────────────────────────────────────────
  {
    phase: 'count',
    title: 'Riżultat — Iż-Żewġ Siġġijiet Mimlija',
    desc:
      `Anna u Brian huma eletti b'${QUOTA} vot kull wieħed. ` +
      `Ebda vot ma' ntilef: il-kartas ta' Eva u David ġew trasfeiriti lill-preferenzi li jmiss tagħhom. ` +
      `F'elezzjoni Maltija reali, kull distrett jgħodd 5 siġġijiet b'kwota madwar 15–17% tal-voti.`,
    bars: [
      { key: 'Anna',  votes: 7, state: 'elected' },
      { key: 'Brian', votes: 7, state: 'elected' },
      { key: 'Clara', votes: 6, state: 'active' },
      { key: 'David', votes: 0, state: 'eliminated' },
      { key: 'Eva',   votes: 0, state: 'eliminated' },
    ],
    transfer: null,
    note: null,
  },
]

// ── Sub-components ──────────────────────────────────────────────────────────

function BallotPaper({ label, prefs }: { label: string; prefs: Record<CandidateKey, number> }) {
  return (
    <div className="bg-white border-2 border-border rounded-xl overflow-hidden shadow-sm text-xs flex-1 min-w-0">
      <div className="bg-muted/60 border-b px-3 py-2 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Karta tal-Vot
        </div>
        <div className="font-bold text-sm mt-0.5">{label}</div>
      </div>
      <div className="text-[10px] text-muted-foreground px-3 py-1.5 border-b bg-muted/30 italic leading-tight">
        Agħti l-preferenzi tiegħek bin-numri (1 = l-ewwel…)
      </div>
      {CANDIDATES.map(c => {
        const pref = prefs[c.key]
        return (
          <div key={c.key} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0">
            <div
              className="w-7 h-7 rounded border-2 flex items-center justify-center font-bold text-sm shrink-0 transition-colors"
              style={{
                borderColor: c.color,
                color: pref === 1 ? '#fff' : c.color,
                backgroundColor: pref === 1 ? c.color : `${c.color}18`,
              }}
            >
              {pref}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate leading-tight">{c.full}</p>
            </div>
            <span
              className="text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${c.color}20`, color: c.color }}
            >
              {c.party}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function VoteBarsDisplay({ step }: { step: CountStep }) {
  return (
    <div className="space-y-4">
      {/* Bars */}
      <div className="space-y-3">
        {step.bars.map(bar => {
          const cand = CANDIDATES.find(c => c.key === bar.key)!
          return (
            <div key={bar.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cand.color }}
                  />
                  <span
                    className={`font-semibold truncate ${
                      bar.state === 'eliminated' ? 'line-through text-muted-foreground' : ''
                    }`}
                  >
                    {cand.full}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{cand.party}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {bar.delta && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">
                      {bar.delta}
                    </span>
                  )}
                  <span
                    className={`font-bold tabular-nums ${
                      bar.state === 'elected' ? 'text-emerald-600' : ''
                    }`}
                  >
                    {bar.votes}
                  </span>
                  {bar.state === 'elected' && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      ELETT ✓
                    </span>
                  )}
                  {bar.state === 'eliminated' && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      ELIMINAT
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-6 bg-muted rounded-md overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-700 ease-out"
                  style={{
                    width: `${(bar.votes / MAX_V) * 100}%`,
                    backgroundColor: cand.color,
                    opacity: bar.state === 'eliminated' ? 0.2 : bar.state === 'elected' ? 0.85 : 1,
                  }}
                />
                {/* Quota marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-orange-500 opacity-80"
                  style={{ left: `${(QUOTA / MAX_V) * 100}%` }}
                />
              </div>
            </div>
          )
        })}

        {/* Quota label */}
        <div className="flex items-center gap-1.5 text-xs text-orange-600 font-semibold">
          <div className="h-3 w-0.5 bg-orange-500" />
          Kwota: {QUOTA} voti (minn {TOTAL} votanti)
        </div>
      </div>

      {/* Transfer callout */}
      {step.transfer && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
          <span className="font-semibold">Trasferiment: </span>
          {step.transfer.count} mill-kandidat{' '}
          <span className="font-semibold">{step.transfer.from}</span> jgħaddu lil{' '}
          <span className="font-semibold">{step.transfer.to}</span>.
        </div>
      )}

      {/* Calculation note */}
      {step.note && (
        <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm font-mono text-muted-foreground leading-relaxed">
          {step.note}
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function STVPage() {
  const [step, setStep] = useState(0)
  const current = STEPS[step]

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <span>STV</span>
      </div>

      <h1 className="text-3xl font-bold mb-2">{s.stv.heading}</h1>
      <p className="text-muted-foreground mb-6 text-sm leading-relaxed max-w-lg">{s.stv.subheading}</p>

      {/* Scenario chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          `${TOTAL} votanti`,
          `${CANDIDATES.length} kandidati`,
          `${SEATS} siġġijiet`,
          `Kwota: ${QUOTA} voti`,
        ].map(label => (
          <span
            key={label}
            className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {label}
          </span>
        ))}
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-5 sm:p-7 space-y-5">
          {/* Step label + title + desc */}
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              {s.stv.step(step + 1, STEPS.length)}
            </p>
            <h2 className="text-lg font-bold">{current.title}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{current.desc}</p>
          </div>

          {/* Phase-specific content */}
          {current.phase === 'ballots' ? (
            <div className="space-y-4">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {EXAMPLE_BALLOTS.map(b => (
                  <BallotPaper key={b.label} label={b.label} prefs={b.prefs} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kull votant jimla karta differenti — xi wħud jivvutaw PL qabel PN, oħrajn bil-maqlub.
                Meta kandidat jiġi eliminat jew jiġi elett b'surplus, il-karta <em>tgħaddi</em> lill-preferenza
                li jmiss fuq dik il-karta partikolari — hekk ħadd ma jitlef il-vot tiegħu.
              </p>
            </div>
          ) : (
            <VoteBarsDisplay step={current} />
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-1">
            <button
              disabled={step === 0}
              onClick={() => setStep(p => p - 1)}
              className="flex-1 h-10 rounded-xl border text-sm font-medium disabled:opacity-30 hover:bg-muted transition-colors"
            >
              {s.stv.prev}
            </button>
            <button
              disabled={step === STEPS.length - 1}
              onClick={() => setStep(p => p + 1)}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:bg-primary/90 transition-colors"
            >
              {s.stv.next}
            </button>
          </div>
        </div>
      </div>

      {/* Context box */}
      <div className="mt-6 rounded-xl bg-muted/50 border p-5 text-sm text-muted-foreground leading-relaxed space-y-2">
        <p>
          <strong className="text-foreground">Malta</strong> tuża s-STV mill-1921 —
          waħda mill-eqdem demokraziji bl-STV fid-dinja.
        </p>
        <p>
          Fil-prattika kull distrett Malti jgħodd <strong className="text-foreground">5 siġġijiet</strong>,
          u l-kwota tkun madwar <strong className="text-foreground">15–17%</strong> tal-voti validi castati.
          L-eżempju hawn fuq juża 2 siġġijiet sabiex il-proċess ikun aktar ċar.
        </p>
        <p>
          <Link href="/ballot" className="text-primary hover:underline underline-offset-4">
            {s.stv.tryBallot} →
          </Link>
        </p>
      </div>
    </div>
  )
}
