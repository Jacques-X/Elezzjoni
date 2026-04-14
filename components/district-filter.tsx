'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import type { Party } from '@/lib/types'

interface DistrictFilterProps {
  parties: Pick<Party, 'id' | 'abbreviation' | 'color_hex' | 'name'>[]
  currentParty: string | undefined
  districtId: number
}

export function DistrictFilter({ parties, currentParty, districtId }: DistrictFilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const setFilter = (partyId: string | null) => {
    const url = partyId
      ? `${pathname}?party=${partyId}`
      : pathname
    router.push(url)
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <span className="text-sm text-muted-foreground mr-1">Filter:</span>

      <button
        onClick={() => setFilter(null)}
        className="text-sm font-medium px-3 py-1.5 rounded-md transition-colors border border-border/60 hover:bg-muted/50 data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-transparent"
        data-active={!currentParty}
      >
        All
      </button>

      {parties.map((party) => (
        <button
          key={party.id}
          onClick={() => setFilter(party.id)}
          className="text-xs font-semibold px-3 py-1.5 rounded-md transition-opacity text-white border-0"
          style={{
            backgroundColor: party.color_hex,
            opacity: currentParty && currentParty !== party.id ? 0.4 : 1,
          }}
        >
          {party.abbreviation}
        </button>
      ))}
    </div>
  )
}
