import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { CandidateCard } from '@/components/candidate-card'
import { DistrictFilter } from '@/components/district-filter'
import { BallotPreview } from '@/components/ballot-preview'
import { MapPin } from 'lucide-react'
import { s } from '@/lib/strings'
import type { CandidateWithParty } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ party?: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  return { title: `${s.districts.districtNum(Number(id))} — Elezzjoni.mt` }
}

export default async function DistrictPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { party: partyFilter } = await searchParams
  const districtId = parseInt(id, 10)

  if (isNaN(districtId) || districtId < 1 || districtId > 13) notFound()

  const supabase = await createClient()

  const [{ data: district }, { data: parties }] = await Promise.all([
    supabase.from('districts').select('*').eq('id', districtId).single(),
    supabase.from('parties').select('id, abbreviation, color_hex, name').order('abbreviation'),
  ])

  if (!district) notFound()

  let query = supabase
    .from('candidates')
    .select('*, party:parties(id, name, abbreviation, color_hex)')
    .contains('districts', [districtId])
    .order('full_name')

  if (partyFilter) query = query.eq('party_id', partyFilter)

  const { data: candidates } = await query

  // Build ballot preview data from candidate list
  const ballotCandidates = (candidates ?? []).map(c => {
    const party = Array.isArray(c.party) ? c.party[0] : c.party
    return {
      name:       c.full_name,
      party:      party?.name ?? '',
      partyColor: party?.color_hex ?? '#6B7280',
    }
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <Link href="/districts" className="hover:text-foreground transition-colors">{s.nav.districts}</Link>
        <span>/</span>
        <span>{district.name}</span>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {s.districts.districtNum(districtId)}
          </span>
          <h1 className="text-3xl font-bold mt-1">{district.name}</h1>

          {district.localities && district.localities.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {district.localities.map((loc: string) => (
                <Badge key={loc} variant="secondary" className="text-xs">{loc}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-4 shrink-0">
          <div className="text-right">
            <div className="text-3xl font-bold">{candidates?.length ?? 0}</div>
            <div className="text-sm text-muted-foreground">{s.districts.candidates}</div>
          </div>
          {ballotCandidates.length > 0 && (
            <BallotPreview
              candidates={ballotCandidates}
              districtName={`${s.districts.districtNum(districtId)} — ${district.name}`}
            />
          )}
        </div>
      </div>

      {parties && parties.length > 0 && (
        <DistrictFilter parties={parties} currentParty={partyFilter} districtId={districtId} />
      )}

      <div className="mt-8">
        {candidates && candidates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c as CandidateWithParty} />
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-16">
            {partyFilter ? s.districts.noResultsFiltered : s.districts.noResultsDistrict}
          </p>
        )}
      </div>
    </div>
  )
}
