'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { getBallot, moveUp, moveDown, toggleStar, clearBallot, type BallotEntry } from '@/lib/ballot'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowUp, ArrowDown, Star, Trash2, ChevronRight, Lock } from 'lucide-react'
import { s } from '@/lib/strings'
import type { CandidateWithParty } from '@/lib/types'

export default function BallotPage() {
  const [entries, setEntries] = useState<BallotEntry[]>([])
  const [candidates, setCandidates] = useState<Record<string, CandidateWithParty>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ballot = getBallot()
    setEntries(ballot)
    if (ballot.length === 0) { setLoading(false); return }

    const supabase = createClient()
    supabase
      .from('candidates')
      .select('*, party:parties(id, name, abbreviation, color_hex)')
      .in('id', ballot.map(e => e.id))
      .then(({ data }) => {
        const map: Record<string, CandidateWithParty> = {}
        data?.forEach(c => {
          const party = Array.isArray(c.party) ? c.party[0] : c.party
          map[c.id] = { ...c, party }
        })
        setCandidates(map)
        setLoading(false)
      })
  }, [])

  function refresh() { setEntries([...getBallot()]) }

  function handleClear() {
    clearBallot()
    setEntries([])
    setCandidates({})
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <span>{s.nav.ballot}</span>
      </div>

      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{s.ballot.heading}</h1>
          <p className="mt-1 text-muted-foreground text-sm">{s.ballot.subheading}</p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors shrink-0"
          >
            <Trash2 size={13} /> {s.ballot.clear}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-20 border border-dashed rounded-xl">
          <Star className="mx-auto mb-3 text-muted-foreground/30" size={32} />
          <p className="text-muted-foreground">{s.ballot.empty}</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">{s.ballot.addTip}</p>
          <Link
            href="/candidates"
            className="text-sm text-primary hover:underline underline-offset-4"
          >
            {s.ballot.browseCta}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => {
            const c = candidates[entry.id]
            if (!c) return null
            const party = c.party
            return (
              <Card key={entry.id} className="flex items-center gap-3 p-3 border-border/60">
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    disabled={idx === 0}
                    onClick={() => { moveUp(entry.id); refresh() }}
                    aria-label={s.ballot.moveUp}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    disabled={idx === entries.length - 1}
                    onClick={() => { moveDown(entry.id); refresh() }}
                    aria-label={s.ballot.moveDown}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                {/* Preference number */}
                <span className="w-7 text-center text-lg font-bold text-muted-foreground/50 shrink-0 tabular-nums">
                  {idx + 1}
                </span>

                {/* Photo */}
                {c.photo_url ? (
                  <Image
                    src={c.photo_url}
                    alt={c.full_name}
                    width={40}
                    height={40}
                    className="rounded-full object-cover h-10 w-10 shrink-0"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: party?.color_hex ?? '#6B7280' }}
                  >
                    {c.full_name.charAt(0)}
                  </div>
                )}

                {/* Name + party */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{c.full_name}</p>
                  {party && (
                    <Badge
                      className="text-[10px] mt-0.5 border-0 text-white"
                      style={{ backgroundColor: party.color_hex }}
                    >
                      {party.abbreviation}
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Link
                    href={`/candidates/${c.id}`}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
                    aria-label="Ara l-profil"
                  >
                    <ChevronRight size={14} />
                  </Link>
                  <button
                    onClick={() => { toggleStar(entry.id); refresh() }}
                    aria-label={s.ballot.remove}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                  >
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                  </button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {entries.length > 0 && (
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock size={11} />
          <span>{s.ballot.privacyNote}</span>
        </div>
      )}
    </div>
  )
}
