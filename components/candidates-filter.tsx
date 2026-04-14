'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { s } from '@/lib/strings'
import type { Party, District } from '@/lib/types'

interface CandidatesFilterProps {
  parties: Pick<Party, 'id' | 'abbreviation' | 'color_hex' | 'name'>[]
  districts: Pick<District, 'id' | 'name'>[]
  currentParty: string | undefined
  currentDistrict: string | undefined
  currentQ: string | undefined
}

export function CandidatesFilter({
  parties,
  districts,
  currentParty,
  currentDistrict,
  currentQ,
}: CandidatesFilterProps) {
  const router = useRouter()
  const pathname = usePathname()

  const pushParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams()
      const merged = { party: currentParty, district: currentDistrict, q: currentQ, ...updates }
      Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v) })
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, currentParty, currentDistrict, currentQ]
  )

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Input
        type="search"
        placeholder={s.filters.searchName}
        defaultValue={currentQ ?? ''}
        onChange={(e) => pushParams({ q: e.target.value.trim() || undefined })}
        className="max-w-xs bg-white"
      />

      <select
        value={currentParty ?? ''}
        onChange={(e) => pushParams({ party: e.target.value || undefined })}
        className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="">{s.filters.allParties}</option>
        {parties.map((p) => (
          <option key={p.id} value={p.id}>{p.abbreviation} — {p.name}</option>
        ))}
      </select>

      <select
        value={currentDistrict ?? ''}
        onChange={(e) => pushParams({ district: e.target.value || undefined })}
        className="h-9 rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        <option value="">{s.filters.allDistricts}</option>
        {districts.map((d) => (
          <option key={d.id} value={d.id.toString()}>
            {s.filters.districtOpt(d.id, d.name)}
          </option>
        ))}
      </select>
    </div>
  )
}
