import Link from 'next/link'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { CandidateWithParty } from '@/lib/types'

interface CandidateCardProps {
  candidate: CandidateWithParty
}

export function CandidateCard({ candidate }: CandidateCardProps) {
  return (
    <Link href={`/candidates/${candidate.id}`} className="block group">
      <Card className="overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 border-border/60 p-0">
        {/* Party colour accent bar */}
        <div
          className="h-1 w-full"
          style={{ backgroundColor: candidate.party?.color_hex ?? '#E5E7EB' }}
        />

        <div className="p-4 flex gap-4 items-start">
          {/* Photo */}
          <div className="shrink-0">
            {candidate.photo_url ? (
              <Image
                src={candidate.photo_url}
                alt={candidate.full_name}
                width={56}
                height={56}
                className="rounded-full object-cover h-14 w-14 ring-2 ring-white shadow-sm"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground ring-2 ring-white shadow-sm">
                {candidate.full_name.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight group-hover:text-primary transition-colors truncate">
              {candidate.full_name}
            </p>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {candidate.party && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 font-semibold border-0 text-white"
                  style={{ backgroundColor: candidate.party.color_hex }}
                >
                  {candidate.party.abbreviation}
                </Badge>
              )}
              {candidate.incumbent && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Incumbent
                </Badge>
              )}
            </div>

            {candidate.personal_stances && candidate.personal_stances.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                {candidate.personal_stances[0]}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

export function CandidateCardSkeleton() {
  return (
    <Card className="overflow-hidden border-border/60 p-0">
      <div className="h-1 w-full bg-muted animate-pulse" />
      <div className="p-4 flex gap-4 items-start">
        <div className="h-14 w-14 rounded-full bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
          <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
          <div className="h-3 w-full bg-muted animate-pulse rounded" />
          <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
        </div>
      </div>
    </Card>
  )
}
