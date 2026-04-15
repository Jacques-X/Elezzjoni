'use client'

import { useState } from 'react'
import Link from 'next/link'
import { s } from '@/lib/strings'

// ── Demo scenario ─────────────────────────────────────────────────────────────
// 3 candidates, 1 seat, 12 voters
// Quota (Droop) = floor(12 / (1+1)) + 1 = 7
//
// Round 1 — First preferences:
//   Anna  (PL) : 5 votes  (voters A–E)
//   Brian (PN) : 4 votes  (voters F–I)
//   Clara (AD) : 3 votes  (voters J–L)
//   → Nobody reaches quota 7.  Lowest (Clara, 3) eliminated.
//
// Transfer: Clara's 3 ballots had 2nd preference: 2×Anna, 1×Brian
//
// Round 2:
//   Anna  : 7 votes (5+2) → ELECTED ✓
//   Brian : 5 votes (4+1)

interface VoteBar {
  name: string
  party: string
  color: string
  votes: number
  state: 'active' | 'elected' | 'eliminated'
}

interface Step {
  title: string
  desc: string
  bars: VoteBar[]
  quota: number
  transfer: { from: string; to: string; votes: number } | null
  note: string | null
}

const STEPS: Step[] = [
  {
    title: 'Pass 1 — L-ewwel preferenzi jingħoddu',
    desc: 'Il-votanti jiktbu n-numru 1 ħdejn l-ewwel kandidat magħżul tagħhom. Dawk il-voti jingħoddu.',
    bars: [
      { name: 'Anna',  party: 'PL', color: '#CF0A2C', votes: 5, state: 'active' },
      { name: 'Brian', party: 'PN', color: '#003DA5', votes: 4, state: 'active' },
      { name: 'Clara', party: 'AD', color: '#00A651', votes: 3, state: 'active' },
    ],
    quota: 7,
    transfer: null,
    note: null,
  },
  {
    title: 'Il-Kwota tiġi kkalkulata',
    desc: 'Il-kwota (jew soglia tal-elezzjoni) hija l-għadd minimu ta\' voti li kandidat jeħtieġ biex jiġi elett. Formula: floor(voti totali ÷ (siġġijiet + 1)) + 1',
    bars: [
      { name: 'Anna',  party: 'PL', color: '#CF0A2C', votes: 5, state: 'active' },
      { name: 'Brian', party: 'PN', color: '#003DA5', votes: 4, state: 'active' },
      { name: 'Clara', party: 'AD', color: '#00A651', votes: 3, state: 'active' },
    ],
    quota: 7,
    transfer: null,
    note: 'floor(12 ÷ 2) + 1 = 7 voti',
  },
  {
    title: 'L-inqas kandidat jiġi eliminat',
    desc: 'Ħadd ma laħaq il-kwota ta\' 7. Clara (3 vot) — l-inqas kandidat — tiġi eliminata. Il-voti tagħha jittrasferixxu skont it-tieni preferenza tal-votanti tagħha.',
    bars: [
      { name: 'Anna',  party: 'PL', color: '#CF0A2C', votes: 5, state: 'active' },
      { name: 'Brian', party: 'PN', color: '#003DA5', votes: 4, state: 'active' },
      { name: 'Clara', party: 'AD', color: '#00A651', votes: 3, state: 'eliminated' },
    ],
    quota: 7,
    transfer: { from: 'Clara', to: 'Anna u Brian', votes: 3 },
    note: '2 voti → Anna  ·  1 vot → Brian',
  },
  {
    title: 'Il-voti jittrasferixxu',
    desc: 'Il-voti ta\' Clara jgħaddu lill-kandidati li kienu t-tieni preferenza tal-votanti. Ħadd ma jitlef il-vot tiegħu!',
    bars: [
      { name: 'Anna',  party: 'PL', color: '#CF0A2C', votes: 7, state: 'elected' },
      { name: 'Brian', party: 'PN', color: '#003DA5', votes: 5, state: 'active' },
      { name: 'Clara', party: 'AD', color: '#00A651', votes: 0, state: 'eliminated' },
    ],
    quota: 7,
    transfer: null,
    note: 'Anna: 5 + 2 = 7 ✓    Brian: 4 + 1 = 5',
  },
  {
    title: 'Anna tiġi eletta!',
    desc: 'Anna laħqet il-kwota ta\' 7 voti u tiġi eletta. F\'elezzjoni reali, din il-proċedura tkompli sal-kandidati kollha li jeħtieġ jintgħażlu, billi jiġu eliminati kandidati jew jittrasferixxu s-surplus.',
    bars: [
      { name: 'Anna',  party: 'PL', color: '#CF0A2C', votes: 7, state: 'elected' },
      { name: 'Brian', party: 'PN', color: '#003DA5', votes: 5, state: 'active' },
      { name: 'Clara', party: 'AD', color: '#00A651', votes: 0, state: 'eliminated' },
    ],
    quota: 7,
    transfer: null,
    note: null,
  },
]

export default function STVPage() {
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const maxVotes = 12

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <span>STV</span>
      </div>

      <h1 className="text-3xl font-bold mb-2">{s.stv.heading}</h1>
      <p className="text-muted-foreground mb-8 text-sm leading-relaxed max-w-lg">{s.stv.subheading}</p>

      {/* Step card */}
      <div className="rounded-2xl border border-border/60 bg-white shadow-sm overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">
              {s.stv.step(step + 1, STEPS.length)}
            </p>
            <h2 className="text-lg font-bold">{current.title}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{current.desc}</p>
          </div>

          {/* Vote bars */}
          <div className="space-y-3">
            {current.bars.map(bar => (
              <div key={bar.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: bar.color }}
                    />
                    <span className={`font-medium ${bar.state === 'eliminated' ? 'line-through text-muted-foreground' : ''}`}>
                      {bar.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{bar.party}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold tabular-nums ${bar.state === 'elected' ? 'text-green-600' : ''}`}>
                      {bar.votes}
                    </span>
                    {bar.state === 'elected'   && <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">ELETT</span>}
                    {bar.state === 'eliminated' && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">ELIMINAT</span>}
                  </div>
                </div>
                <div className="relative h-6 bg-muted rounded-md overflow-hidden">
                  <div
                    className="h-full rounded-md transition-all duration-700 ease-out"
                    style={{
                      width: `${(bar.votes / maxVotes) * 100}%`,
                      backgroundColor: bar.color,
                      opacity: bar.state === 'eliminated' ? 0.2 : 1,
                    }}
                  />
                  {/* Quota marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-orange-500 opacity-70"
                    style={{ left: `${(current.quota / maxVotes) * 100}%` }}
                  />
                </div>
              </div>
            ))}

            {/* Quota label */}
            <div className="flex items-center gap-2 text-xs text-orange-600 font-semibold">
              <div className="h-3 w-px bg-orange-500" />
              {s.stv.quota(current.quota)} (minn {maxVotes} voti totali)
            </div>
          </div>

          {/* Transfer callout */}
          {current.transfer && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm">
              <span className="font-semibold">Trasferiment: </span>
              {current.transfer.votes} voti mill-kandidat eliminat ({current.transfer.from}) jgħaddu lil {current.transfer.to}.
            </div>
          )}

          {/* Calculation note */}
          {current.note && (
            <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm font-mono text-muted-foreground">
              {current.note}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
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
        <p><strong className="text-foreground">Malta</strong> tuża s-STV mill-1921 — waħda mill-eqdem demokraziji bl-STV fid-dinja.</p>
        <p>Fil-prattika kull distrett Malti jgħodd bejn 5 u 6 siġġijiet, u l-kwota tkun madwar 15–17% tal-voti validi kastati.</p>
        <p>
          <Link href="/ballot" className="text-primary hover:underline underline-offset-4">
            {s.stv.tryBallot} →
          </Link>
        </p>
      </div>
    </div>
  )
}
