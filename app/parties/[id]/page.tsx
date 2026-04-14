import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CandidateCard } from '@/components/candidate-card'
import { Users } from 'lucide-react'
import { s } from '@/lib/strings'
import type { CandidateWithParty } from '@/lib/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: party } = await supabase.from('parties').select('name').eq('id', id).single()
  return { title: `${party?.name ?? s.parties.fallback} — Elezzjoni.mt` }
}

export default async function PartyPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: party }, { data: candidates }] = await Promise.all([
    supabase.from('parties').select('*').eq('id', id).single(),
    supabase.from('candidates').select('*, party:parties(id, name, abbreviation, color_hex)').eq('party_id', id).order('full_name'),
  ])

  if (!party) notFound()

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <Link href="/parties" className="hover:text-foreground transition-colors">{s.nav.parties}</Link>
        <span>/</span>
        <span>{party.name}</span>
      </div>

      <div className="rounded-xl p-8 mb-10 text-white relative overflow-hidden" style={{ backgroundColor: party.color_hex }}>
        <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        <div className="relative flex items-center gap-5">
          {party.logo_url ? (
            <Image src={party.logo_url} alt={`${party.name} logo`} width={72} height={72} className="rounded-lg object-contain bg-white/20 p-2" />
          ) : (
            <div className="rounded-lg bg-white/20 flex items-center justify-center text-2xl font-bold px-4 py-3">
              {party.abbreviation}
            </div>
          )}
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-widest">{party.abbreviation}</p>
            <h1 className="text-3xl font-bold mt-1">{party.name}</h1>
            <div className="flex items-center gap-2 mt-2 text-white/80 text-sm">
              <Users className="h-4 w-4" />
              <span>{candidates?.length ?? 0} {s.parties.candidates}</span>
            </div>
          </div>
        </div>
      </div>

      {candidates && candidates.length > 0 ? (
        <div>
          <h2 className="text-xl font-bold mb-6">{s.nav.candidates}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c as CandidateWithParty} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-16">{s.parties.empty}</p>
      )}
    </div>
  )
}
