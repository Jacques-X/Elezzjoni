import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  MapPin, Globe, Quote, Sparkles, Clock, Share2,
  Building2, FileText, Scale, TrendingUp, MessageSquare,
  Award, Users,
} from 'lucide-react'
import { s } from '@/lib/strings'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('candidates').select('full_name').eq('id', id).single()
  return { title: `${data?.full_name ?? s.candidates.fallback} — Kandidati.mt` }
}

// ── Inline sub-components ─────────────────────────────────────────────────────

function VoteChip({ choice }: { choice: string }) {
  const variants: Record<string, { label: string; cls: string }> = {
    yes:     { label: s.candidateProfile.votesYes,     cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    no:      { label: s.candidateProfile.votesNo,      cls: 'bg-rose-100 text-rose-800 border-rose-200' },
    abstain: { label: s.candidateProfile.votesAbstain, cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  }
  const v = variants[choice?.toLowerCase()] ?? { label: choice ?? '—', cls: 'bg-muted text-muted-foreground border-border' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${v.cls} shrink-0`}>
      {v.label}
    </span>
  )
}

function StatBox({ value, label, color }: { value: number | string; label: string; color?: string }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/40 flex-1">
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, badge }: {
  icon: React.ElementType; title: string; badge?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <h2 className="font-semibold text-base">{title}</h2>
      {badge && <Badge variant="secondary" className="text-[10px] ml-auto shrink-0">{badge}</Badge>}
    </div>
  )
}

function StatusPill({ status }: { status: string | null }) {
  const cls =
    status === 'active'    ? 'bg-emerald-100 text-emerald-700' :
    status === 'dissolved' ? 'bg-rose-100 text-rose-700' :
                             'bg-slate-100 text-slate-600'
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${cls}`}>
      {status ?? '—'}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function CandidatePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: candidate } = await supabase
    .from('candidates')
    .select('*, party:parties(id, name, abbreviation, color_hex, logo_url)')
    .eq('id', id)
    .single()

  if (!candidate) notFound()

  // All sub-table queries in parallel — errors treated as empty
  const [
    { data: districts },
    { data: businessInterests },
    { data: disclosures },
    { data: legalRecords },
    { data: votes },
    { data: pqs },
    { data: electoralHistory },
  ] = await Promise.all([
    supabase.from('districts').select('id, name').in('id', candidate.districts ?? []),
    supabase.from('candidate_business_interests')
      .select('*').eq('candidate_id', id).order('status'),
    supabase.from('candidate_disclosures')
      .select('*').eq('candidate_id', id).order('date_filed', { ascending: false }),
    supabase.from('candidate_legal_records')
      .select('*').eq('candidate_id', id).order('case_date', { ascending: false }),
    supabase.from('parliamentary_votes')
      .select('*').eq('candidate_id', id)
      .gte('llm_confidence', 0.7)
      .order('session_date', { ascending: false })
      .limit(20),
    supabase.from('candidate_parliamentary_questions')
      .select('*').eq('candidate_id', id)
      .order('question_date', { ascending: false })
      .limit(12),
    supabase.from('candidate_electoral_history')
      .select('*').eq('candidate_id', id)
      .order('election_year', { ascending: false }),
  ])

  const party      = candidate.party
  const partyColor = party?.color_hex ?? '#6B7280'
  const lastUpdated = candidate.last_updated
    ? new Date(candidate.last_updated).toLocaleDateString('mt-MT', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  // Vote stats
  const votesList    = votes ?? []
  const yesCount     = votesList.filter((v: { vote_choice: string }) => v.vote_choice === 'yes').length
  const noCount      = votesList.filter((v: { vote_choice: string }) => v.vote_choice === 'no').length
  const abstainCount = votesList.filter((v: { vote_choice: string }) => v.vote_choice === 'abstain').length

  // Independence score (0–100, -1 = no political content)
  const score    = candidate.party_reliance_score
  const hasScore = typeof score === 'number' && score >= 0

  // PQ minister frequency
  const pqList = pqs ?? []
  const ministerCounts: Record<string, number> = {}
  for (const q of pqList) {
    if (q.minister_addressed) {
      ministerCounts[q.minister_addressed] = (ministerCounts[q.minister_addressed] ?? 0) + 1
    }
  }
  const topMinisters = Object.entries(ministerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">{s.nav.home}</Link>
        <span>/</span>
        <Link href="/candidates" className="hover:text-foreground transition-colors">{s.nav.candidates}</Link>
        <span>/</span>
        <span className="truncate max-w-[180px]">{candidate.full_name}</span>
      </div>

      {/* ── Profile header ── */}
      <div className="bg-white rounded-xl border border-border/60 overflow-hidden shadow-sm">
        <div className="h-2 w-full" style={{ backgroundColor: partyColor }} />
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-6 items-start">

            {/* Photo */}
            <div className="shrink-0">
              {candidate.photo_url ? (
                <Image
                  src={candidate.photo_url}
                  alt={candidate.full_name}
                  width={128} height={128}
                  className="rounded-2xl object-cover h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-white shadow"
                />
              ) : (
                <div
                  className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl flex items-center justify-center text-4xl font-bold text-white shadow ring-4 ring-white"
                  style={{ backgroundColor: partyColor }}
                >
                  {candidate.full_name.charAt(0)}
                </div>
              )}
            </div>

            {/* Name / meta */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-2 mb-2">
                {party && (
                  <Link href={`/parties/${party.id}`}>
                    <Badge
                      className="text-xs font-bold border-0 text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: partyColor }}
                    >
                      {party.abbreviation} · {party.name}
                    </Badge>
                  </Link>
                )}
                {candidate.incumbent && (
                  <Badge variant="secondary" className="text-xs">
                    {s.candidateProfile.incumbent}
                  </Badge>
                )}
                {candidate.is_mp && (
                  <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">
                    {s.candidateProfile.mpLabel}
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{candidate.full_name}</h1>

              {candidate.current_position && (
                <p className="mt-1 text-base text-muted-foreground">{candidate.current_position}</p>
              )}

              {/* Districts */}
              {districts && districts.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {districts.map((d: { id: number; name: string }) => (
                    <Link key={d.id} href={`/districts/${d.id}`}>
                      <Badge variant="outline" className="text-xs hover:bg-muted/50 transition-colors cursor-pointer">
                        {s.candidateProfile.districtLabel(d.id)} · {d.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}

              {/* Social links */}
              {candidate.social_links && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {candidate.social_links.facebook && (
                    <a href={candidate.social_links.facebook} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Share2 className="h-4 w-4" /> {s.candidateProfile.socialFacebook}
                    </a>
                  )}
                  {candidate.social_links.instagram && (
                    <a href={candidate.social_links.instagram} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Share2 className="h-4 w-4" /> {s.candidateProfile.socialInstagram}
                    </a>
                  )}
                  {candidate.social_links.website && (
                    <a href={candidate.social_links.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Globe className="h-4 w-4" /> {s.candidateProfile.socialWebsite}
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Parliament bio */}
          {candidate.parliament_bio && (
            <div className="mt-6 pt-6 border-t border-border/40">
              <p className="text-sm text-muted-foreground leading-relaxed">{candidate.parliament_bio}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Content sections ── */}
      <div className="mt-6 space-y-6">

        {/* Parliamentary record + independence score — for MPs with vote data */}
        {candidate.is_mp && votesList.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={TrendingUp} title={s.candidateProfile.parliamentaryRecordTitle} />

            {/* Vote count stats */}
            <div className="flex gap-3 mb-6">
              <StatBox value={votesList.length} label={s.candidateProfile.totalVotes} />
              <StatBox value={yesCount}     label={s.candidateProfile.votesYes}     color="#10b981" />
              <StatBox value={noCount}      label={s.candidateProfile.votesNo}      color="#f43f5e" />
              <StatBox value={abstainCount} label={s.candidateProfile.votesAbstain} />
            </div>

            {/* Independence bar — nested here for MPs */}
            {hasScore && (
              <div className="mb-6 rounded-lg bg-muted/30 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.candidateProfile.independent}
                  </span>
                  <span className="text-sm font-bold">{score}/100</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {s.candidateProfile.partyLoyal}
                  </span>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md border-2 border-white ring-1 ring-slate-300 transition-[left]"
                    style={{ left: `calc(${score}% - 10px)` }}
                  />
                </div>
                {candidate.score_justification && (
                  <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                    {candidate.score_justification}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground/60">{s.candidateProfile.scoreNote}</p>
              </div>
            )}

            {/* Recent votes */}
            <h3 className="text-sm font-medium mb-3">{s.candidateProfile.recentVotesTitle}</h3>
            <div className="divide-y divide-border/40">
              {votesList.slice(0, 10).map((vote: {
                bill_name?: string; vote_type?: string; session_date?: string; vote_choice: string;
                session_url?: string;
              }, i: number) => (
                <div key={i} className="py-3 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      {vote.bill_name || vote.vote_type || '—'}
                    </p>
                    {vote.session_date && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {new Date(vote.session_date).toLocaleDateString('mt-MT', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                  <VoteChip choice={vote.vote_choice} />
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Independence score — standalone for non-MPs */}
        {!candidate.is_mp && hasScore && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader
              icon={TrendingUp}
              title={s.candidateProfile.independenceTitle}
              badge={s.candidateProfile.scoreAiBadge}
            />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">{s.candidateProfile.independent}</span>
              <span className="text-sm font-bold">{score}/100</span>
              <span className="text-xs font-medium text-muted-foreground">{s.candidateProfile.partyLoyal}</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500">
              <div
                className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-white shadow-md border-2 border-white ring-1 ring-slate-300"
                style={{ left: `calc(${score}% - 10px)` }}
              />
            </div>
            {candidate.score_justification && (
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                {candidate.score_justification}
              </p>
            )}
            <p className="mt-2 text-[11px] text-muted-foreground/60">{s.candidateProfile.scoreNote}</p>
          </Card>
        )}

        {/* Parliamentary questions */}
        {pqList.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={MessageSquare} title={s.candidateProfile.pqTitle} />

            <p className="text-sm text-muted-foreground mb-5">{s.candidateProfile.pqTotal(pqList.length)}</p>

            {topMinisters.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {s.candidateProfile.pqTopMinisters}
                </p>
                <div className="flex flex-wrap gap-2">
                  {topMinisters.map(([minister, count]) => (
                    <span
                      key={minister}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs"
                    >
                      {minister}
                      <span className="text-muted-foreground font-medium">({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="divide-y divide-border/40">
              {pqList.map((pq: {
                question_type?: string; question_date?: string;
                minister_addressed?: string; question_text: string;
              }, i: number) => (
                <div key={i} className="py-3">
                  <div className="flex items-start gap-2 mb-1.5 flex-wrap">
                    {pq.question_type && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {pq.question_type === 'oral'
                          ? s.candidateProfile.pqOral
                          : s.candidateProfile.pqWritten}
                      </Badge>
                    )}
                    {pq.question_date && (
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(pq.question_date).toLocaleDateString('mt-MT', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    )}
                    {pq.minister_addressed && (
                      <span className="text-[11px] text-muted-foreground ml-auto">
                        → {pq.minister_addressed}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{pq.question_text}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Committee memberships */}
        {candidate.committee_memberships && candidate.committee_memberships.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={Users} title={s.candidateProfile.committeesTitle} />
            <ul className="space-y-2">
              {candidate.committee_memberships.map((c: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Key positions */}
        {((candidate.personal_stances?.length ?? 0) > 0 ||
          (candidate.priority_tags?.length ?? 0) > 0) && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader
              icon={Sparkles}
              title={s.candidateProfile.stancesTitle}
              badge={s.candidateProfile.stancesBadge}
            />

            {candidate.priority_tags && candidate.priority_tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {candidate.priority_tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}

            {candidate.personal_stances && candidate.personal_stances.length > 0 && (
              <ul className="space-y-3">
                {candidate.personal_stances.map((stance: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: partyColor }}
                    />
                    <span className="leading-relaxed">{stance}</span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-[11px] text-muted-foreground">{s.candidateProfile.stancesNote}</p>
          </Card>
        )}

        {/* Key quotes */}
        {candidate.key_quotes && candidate.key_quotes.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader
              icon={Quote}
              title={s.candidateProfile.quotesTitle}
              badge={s.candidateProfile.quotesBadge}
            />
            <div className="space-y-4">
              {candidate.key_quotes.map((quote: string, i: number) => (
                <blockquote
                  key={i}
                  className="pl-4 border-l-2 text-sm italic text-muted-foreground leading-relaxed"
                  style={{ borderColor: partyColor }}
                >
                  &ldquo;{quote}&rdquo;
                </blockquote>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground">{s.candidateProfile.quotesNote}</p>
          </Card>
        )}

        {/* Business interests */}
        {businessInterests && businessInterests.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={Building2} title={s.candidateProfile.businessTitle} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2 pr-4 font-medium">{s.candidateProfile.businessCompany}</th>
                    <th className="text-left py-2 pr-4 font-medium">{s.candidateProfile.businessRole}</th>
                    <th className="text-left py-2 font-medium">{s.candidateProfile.businessStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {businessInterests.map((b: {
                    company_name: string; role?: string; status?: string;
                    ownership_pct?: number; url?: string; company_registration_id?: string;
                  }, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4">
                        {b.url ? (
                          <a
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {b.company_name}
                          </a>
                        ) : b.company_name}
                        {b.ownership_pct != null && (
                          <span className="ml-1.5 text-[11px] text-muted-foreground">
                            ({b.ownership_pct}%)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground capitalize">{b.role ?? '—'}</td>
                      <td className="py-2.5"><StatusPill status={b.status ?? null} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">{s.candidateProfile.businessSource}</p>
          </Card>
        )}

        {/* Financial disclosures */}
        {disclosures && disclosures.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={FileText} title={s.candidateProfile.disclosuresTitle} />
            <div className="divide-y divide-border/40">
              {disclosures.map((d: {
                disclosure_type?: string; date_filed?: string;
                disclosed_value?: string; source_url?: string;
              }, i: number) => (
                <div key={i} className="py-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-sm font-medium capitalize">
                      {d.disclosure_type?.replace(/_/g, ' ') ?? '—'}
                    </span>
                    {d.date_filed && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(d.date_filed).toLocaleDateString('mt-MT', {
                          month: 'short', year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                  {d.disclosed_value && (
                    <p className="text-sm text-muted-foreground">{d.disclosed_value}</p>
                  )}
                  {d.source_url && (
                    <a
                      href={d.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 hover:underline mt-1 inline-block"
                    >
                      {s.candidateProfile.sourceLink}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Legal records */}
        {legalRecords && legalRecords.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={Scale} title={s.candidateProfile.legalTitle} />
            <div className="divide-y divide-border/40">
              {legalRecords.map((lr: {
                case_type?: string; severity?: string; outcome?: string;
                description?: string; case_date?: string; source_url?: string;
              }, i: number) => (
                <div key={i} className="py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${
                            lr.severity === 'high'   ? 'border-rose-200 text-rose-700 bg-rose-50' :
                            lr.severity === 'medium' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                            ''
                          }`}
                        >
                          {lr.case_type ?? s.candidateProfile.legalCaseType}
                        </Badge>
                        {lr.outcome && (
                          <span className="text-[11px] text-muted-foreground capitalize">{lr.outcome}</span>
                        )}
                      </div>
                      {lr.description && (
                        <p className="text-sm leading-relaxed">{lr.description}</p>
                      )}
                      {lr.source_url && (
                        <a
                          href={lr.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline mt-1 inline-block"
                        >
                          {s.candidateProfile.sourceLink}
                        </a>
                      )}
                    </div>
                    {lr.case_date && (
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {new Date(lr.case_date).toLocaleDateString('mt-MT', {
                          month: 'short', year: 'numeric',
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Electoral history */}
        {electoralHistory && electoralHistory.length > 0 && (
          <Card className="p-6 border-border/60 shadow-sm">
            <SectionHeader icon={Award} title={s.candidateProfile.electoralHistoryTitle} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2 pr-4 font-medium">{s.candidateProfile.electoralYear}</th>
                    <th className="text-left py-2 pr-4 font-medium">{s.candidateProfile.electoralDistrict}</th>
                    <th className="text-right py-2 pr-4 font-medium">{s.candidateProfile.electoralFirstPref}</th>
                    <th className="text-left py-2 font-medium">{s.candidateProfile.electoralResult}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {electoralHistory.map((eh: {
                    election_year: number; district_id?: number;
                    first_preference_votes?: number; final_count_votes?: number;
                    elected?: boolean;
                  }, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5 pr-4 font-semibold">{eh.election_year}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {eh.district_id ? s.candidateProfile.districtLabel(eh.district_id) : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono tabular-nums">
                        {eh.first_preference_votes != null
                          ? eh.first_preference_votes.toLocaleString('en')
                          : '—'}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          eh.elected
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {eh.elected
                            ? s.candidateProfile.electoralElected
                            : s.candidateProfile.electoralNotElected}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      </div>

      {/* Footer */}
      {lastUpdated && (
        <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>{s.candidateProfile.lastUpdated(lastUpdated)}</span>
        </div>
      )}

    </div>
  )
}
