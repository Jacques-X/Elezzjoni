import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CandidateCard } from '@/components/candidate-card'
import { CandidatesFilter } from '@/components/candidates-filter'
import { s } from '@/lib/strings'
import type { CandidateWithParty } from '@/lib/types'

export const metadata = {
  title: s.candidates.metaTitle,
  description: s.candidates.metaDesc,
}

interface PageProps {
  searchParams: Promise<{ party?: string; district?: string; q?: string }>
}

export default async function CandidatesPage({ searchParams }: PageProps) {
  const { party: partyFilter, district: districtFilter, q } = await searchParams

  const supabase = await createClient()

  const [{ data: parties }, { data: districts }] = await Promise.all([
    supabase.from('parties').select('id, name, abbreviation, color_hex').order('abbreviation'),
    supabase.from('districts').select('id, name').order('id'),
  ])

  let query = supabase
    .from('candidates')
    .select('*, party:parties(id, name, abbreviation, color_hex)')
    .order('full_name')

  if (partyFilter) query = query.eq('party_id', partyFilter)
  if (districtFilter) query = query.contains('districts', [parseInt(districtFilter, 10)])
  if (q) query = query.ilike('full_name', `%${q}%`)

  const { data: candidates } = await query

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <span>{s.nav.candidates}</span>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{s.candidates.heading}</h1>
          <p className="mt-1 text-muted-foreground">{s.candidates.found(candidates?.length ?? 0)}</p>
        </div>
      </div>

      <CandidatesFilter
        parties={parties ?? []}
        districts={districts ?? []}
        currentParty={partyFilter}
        currentDistrict={districtFilter}
        currentQ={q}
      />

      <div className="mt-8">
        {candidates && candidates.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c as CandidateWithParty} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">{s.candidates.noResults}</p>
            <Link href="/candidates" className="text-sm text-primary underline-offset-4 hover:underline mt-2 inline-block">
              {s.candidates.clearFilters}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
