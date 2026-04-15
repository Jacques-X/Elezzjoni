import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { MapPin, Sparkles } from 'lucide-react'
import { s } from '@/lib/strings'

export const metadata = { title: s.compare.metaTitle }

interface PageProps {
  searchParams: Promise<{ a?: string; b?: string }>
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { a, b } = await searchParams

  if (!a || !b) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold mb-3">{s.compare.heading}</h1>
        <p className="text-muted-foreground mb-6">{s.compare.pickBtn}</p>
        <Link href="/candidates" className="text-primary hover:underline underline-offset-4 text-sm">
          {s.nav.candidates}
        </Link>
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: ca }, { data: cb }] = await Promise.all([
    supabase.from('candidates').select('*, party:parties(id, name, abbreviation, color_hex)').eq('id', a).single(),
    supabase.from('candidates').select('*, party:parties(id, name, abbreviation, color_hex)').eq('id', b).single(),
  ])

  if (!ca || !cb) notFound()

  const partyA = Array.isArray(ca.party) ? ca.party[0] : ca.party
  const partyB = Array.isArray(cb.party) ? cb.party[0] : cb.party

  const [{ data: districtsA }, { data: districtsB }] = await Promise.all([
    supabase.from('districts').select('id, name').in('id', ca.districts ?? []),
    supabase.from('districts').select('id, name').in('id', cb.districts ?? []),
  ])

  const rows = [
    {
      label: s.compare.party,
      a: partyA ? (
        <Link href={`/parties/${partyA.id}`}>
          <Badge className="border-0 text-white text-xs" style={{ backgroundColor: partyA.color_hex }}>
            {partyA.abbreviation} · {partyA.name}
          </Badge>
        </Link>
      ) : '—',
      b: partyB ? (
        <Link href={`/parties/${partyB.id}`}>
          <Badge className="border-0 text-white text-xs" style={{ backgroundColor: partyB.color_hex }}>
            {partyB.abbreviation} · {partyB.name}
          </Badge>
        </Link>
      ) : '—',
    },
    {
      label: s.compare.districts,
      a: (
        <div className="flex flex-wrap gap-1 justify-end">
          {(districtsA ?? []).map(d => (
            <Link key={d.id} href={`/districts/${d.id}`}>
              <Badge variant="outline" className="text-[10px]">{d.name}</Badge>
            </Link>
          ))}
        </div>
      ),
      b: (
        <div className="flex flex-wrap gap-1">
          {(districtsB ?? []).map(d => (
            <Link key={d.id} href={`/districts/${d.id}`}>
              <Badge variant="outline" className="text-[10px]">{d.name}</Badge>
            </Link>
          ))}
        </div>
      ),
    },
    {
      label: s.compare.incumbent,
      a: ca.incumbent ? s.compare.yes : s.compare.no,
      b: cb.incumbent ? s.compare.yes : s.compare.no,
    },
  ]

  const maxStances = Math.max(
    ca.personal_stances?.length ?? 0,
    cb.personal_stances?.length ?? 0,
  )

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <span>{s.compare.heading}</span>
      </div>

      <h1 className="text-2xl font-bold mb-8">{s.compare.heading}</h1>

      {/* Header cards */}
      <div className="grid grid-cols-[1fr_48px_1fr] gap-3 mb-6 items-center">
        <CandidateHeader
          candidate={ca}
          party={partyA}
          align="right"
        />
        <div className="text-center text-sm font-bold text-muted-foreground">{s.compare.vs}</div>
        <CandidateHeader
          candidate={cb}
          party={partyB}
          align="left"
        />
      </div>

      {/* Comparison table */}
      <Card className="overflow-hidden border-border/60 mb-6">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_100px_1fr] border-b last:border-b-0"
          >
            <div className="p-3 flex items-center justify-end text-sm">{row.a}</div>
            <div className="p-3 flex items-center justify-center text-[11px] font-semibold text-muted-foreground bg-muted/40 border-x text-center">
              {row.label}
            </div>
            <div className="p-3 flex items-center text-sm">{row.b}</div>
          </div>
        ))}
      </Card>

      {/* Stances side-by-side */}
      {maxStances > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} className="text-muted-foreground" />
            <h2 className="font-semibold">{s.compare.stances}</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StancesList
              stances={ca.personal_stances}
              color={partyA?.color_hex}
              name={ca.full_name}
            />
            <StancesList
              stances={cb.personal_stances}
              color={partyB?.color_hex}
              name={cb.full_name}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function CandidateHeader({
  candidate,
  party,
  align,
}: {
  candidate: { id: string; full_name: string; photo_url: string | null; incumbent: boolean }
  party: { color_hex: string; abbreviation: string } | null | undefined
  align: 'left' | 'right'
}) {
  return (
    <Card className={`p-4 border-border/60 flex items-center gap-3 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <div className="h-2 absolute top-0 inset-x-0 rounded-t-xl hidden" />
      {candidate.photo_url ? (
        <Image
          src={candidate.photo_url}
          alt={candidate.full_name}
          width={52}
          height={52}
          className="rounded-full object-cover h-13 w-13 shrink-0"
        />
      ) : (
        <div
          className="h-13 w-13 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
          style={{ backgroundColor: party?.color_hex ?? '#6B7280' }}
        >
          {candidate.full_name.charAt(0)}
        </div>
      )}
      <div className="min-w-0">
        <Link href={`/candidates/${candidate.id}`}>
          <p className="font-bold text-sm leading-tight hover:text-primary transition-colors truncate">
            {candidate.full_name}
          </p>
        </Link>
        <div className={`flex gap-1 mt-1 flex-wrap ${align === 'right' ? 'justify-end' : ''}`}>
          {party && (
            <Badge className="text-[10px] border-0 text-white" style={{ backgroundColor: party.color_hex }}>
              {party.abbreviation}
            </Badge>
          )}
          {candidate.incumbent && (
            <Badge variant="secondary" className="text-[10px]">
              {s.candidateProfile.incumbent}
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}

function StancesList({
  stances,
  color,
  name,
}: {
  stances: string[] | null | undefined
  color: string | undefined
  name: string
}) {
  return (
    <Card className="p-4 border-border/60 h-full">
      <p className="text-xs font-semibold text-muted-foreground mb-3 truncate">{name}</p>
      {stances && stances.length > 0 ? (
        <ul className="space-y-2.5">
          {stances.map((stance, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span
                className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color ?? '#6B7280' }}
              />
              <span className="text-foreground leading-relaxed">{stance}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">{s.compare.noStances}</p>
      )}
    </Card>
  )
}
