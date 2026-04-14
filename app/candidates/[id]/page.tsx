import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card } from '@/components/ui/card'
import {
  MapPin,
  ExternalLink,
  Globe,
  Quote,
  Sparkles,
  Clock,
  Share2,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('candidates').select('full_name').eq('id', id).single()
  return { title: `${data?.full_name ?? 'Candidate'} — Elezzjoni.mt` }
}

export default async function CandidatePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, party:parties(id, name, abbreviation, color_hex, logo_url)')
    .eq('id', id)
    .single()

  if (!candidate) notFound()

  // Fetch district names
  const { data: districts } = await supabase
    .from('districts')
    .select('id, name')
    .in('id', candidate.districts ?? [])

  const party = candidate.party
  const lastUpdated = new Date(candidate.last_updated).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <Link href="/candidates" className="hover:text-foreground transition-colors">Candidates</Link>
        <span>/</span>
        <span className="truncate max-w-[160px]">{candidate.full_name}</span>
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-xl border border-border/60 overflow-hidden shadow-sm">
        {/* Party colour stripe */}
        <div className="h-2 w-full" style={{ backgroundColor: party?.color_hex ?? '#E5E7EB' }} />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="shrink-0">
              {candidate.photo_url ? (
                <Image
                  src={candidate.photo_url}
                  alt={candidate.full_name}
                  width={120}
                  height={120}
                  className="rounded-2xl object-cover h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-white shadow"
                />
              ) : (
                <div
                  className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shadow ring-4 ring-white"
                  style={{ backgroundColor: party?.color_hex ?? '#6B7280' }}
                >
                  {candidate.full_name.charAt(0)}
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                {party && (
                  <Link href={`/parties/${party.id}`}>
                    <Badge
                      className="text-xs font-bold border-0 text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: party.color_hex }}
                    >
                      {party.abbreviation} · {party.name}
                    </Badge>
                  </Link>
                )}
                {candidate.incumbent && (
                  <Badge variant="secondary" className="text-xs">
                    Incumbent
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{candidate.full_name}</h1>

              {/* Districts */}
              {districts && districts.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {districts.map((d) => (
                    <Link key={d.id} href={`/districts/${d.id}`}>
                      <Badge variant="outline" className="text-xs hover:bg-muted/50 transition-colors cursor-pointer">
                        District {d.id} · {d.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}

              {/* Social links */}
              {candidate.social_links && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.social_links.facebook && (
                    <a
                      href={candidate.social_links.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Share2 className="h-4 w-4" /> Facebook
                    </a>
                  )}
                  {candidate.social_links.instagram && (
                    <a
                      href={candidate.social_links.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Share2 className="h-4 w-4" /> Instagram
                    </a>
                  )}
                  {candidate.social_links.website && (
                    <a
                      href={candidate.social_links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Globe className="h-4 w-4" /> Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content sections */}
      <div className="mt-6 grid grid-cols-1 gap-6">

        {/* Key stances */}
        {candidate.personal_stances && candidate.personal_stances.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-base">Key Stances</h2>
              <Badge variant="secondary" className="text-[10px] ml-auto">AI Summary</Badge>
            </div>
            <ul className="space-y-3">
              {candidate.personal_stances.map((stance: string, i: number) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: party?.color_hex ?? '#6B7280' }}
                  />
                  <span className="text-foreground leading-relaxed">{stance}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-muted-foreground">
              AI-generated summary based on publicly available statements. Verify independently.
            </p>
          </Card>
        )}

        {/* Key quotes */}
        {candidate.key_quotes && candidate.key_quotes.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Quote className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-base">Key Quotes</h2>
              <Badge variant="secondary" className="text-[10px] ml-auto">AI Extracted</Badge>
            </div>
            <div className="space-y-4">
              {candidate.key_quotes.map((quote: string, i: number) => (
                <blockquote key={i} className="pl-4 border-l-2 text-sm italic text-muted-foreground leading-relaxed" style={{ borderColor: party?.color_hex ?? '#E5E7EB' }}>
                  "{quote}"
                </blockquote>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Extracted from public speeches, interviews, and party materials.
            </p>
          </Card>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>Last updated: {lastUpdated}</span>
      </div>
    </div>
  )
}
