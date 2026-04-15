'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { s } from '@/lib/strings'
import { cn } from '@/lib/utils'
import { ALL_TAGS, type PriorityTag } from '@/lib/types'
import type { Party, District } from '@/lib/types'

interface CandidatesFilterProps {
  parties: Pick<Party, 'id' | 'abbreviation' | 'color_hex' | 'name'>[]
  districts: Pick<District, 'id' | 'name'>[]
  currentParty: string | undefined
  currentDistrict: string | undefined
  currentQ: string | undefined
  currentTags: PriorityTag[]
}

export function CandidatesFilter({
  parties,
  districts,
  currentParty,
  currentDistrict,
  currentQ,
  currentTags,
}: CandidatesFilterProps) {
  const router   = useRouter()
  const pathname = usePathname()

  const pushParams = useCallback(
    (updates: Record<string, string | string[] | undefined>) => {
      const params  = new URLSearchParams()
      const merged  = {
        party:    currentParty,
        district: currentDistrict,
        q:        currentQ,
        tags:     currentTags.length > 0 ? currentTags : undefined,
        ...updates,
      }
      Object.entries(merged).forEach(([k, v]) => {
        if (Array.isArray(v)) v.forEach(val => params.append(k, val))
        else if (v) params.set(k, v as string)
      })
      router.push(`${pathname}?${params.toString()}`)
    },
    [pathname, router, currentParty, currentDistrict, currentQ, currentTags]
  )

  function toggleTag(tag: PriorityTag) {
    const next = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    pushParams({ tags: next.length > 0 ? next : undefined })
  }

  return (
    <div className="space-y-3">
      {/* Text + selects row */}
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

      {/* Tag chips */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-xs text-muted-foreground mr-1">{s.filters.tagsLabel}</span>
        {ALL_TAGS.map(tag => (
          <button
            key={tag}
            onClick={() => toggleTag(tag)}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              currentTags.includes(tag)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border bg-white hover:bg-muted/60'
            )}
          >
            {tag}
          </button>
        ))}
        {currentTags.length > 0 && (
          <button
            onClick={() => pushParams({ tags: undefined })}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            ✕ {s.filters.allTags}
          </button>
        )}
      </div>
    </div>
  )
}
