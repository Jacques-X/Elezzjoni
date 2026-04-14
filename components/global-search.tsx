'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { s } from '@/lib/strings'
import type { Party } from '@/lib/types'

interface SearchResult {
  id: string
  full_name: string
  party?: Pick<Party, 'abbreviation' | 'color_hex'>
}

export function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const timeout = setTimeout(async () => {
      setLoading(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('candidates')
        .select('id, full_name, party:parties(abbreviation, color_hex)')
        .ilike('full_name', `%${query}%`)
        .limit(8)

      const normalised: SearchResult[] = (data ?? []).map((row: any) => ({
        ...row,
        party: Array.isArray(row.party) ? row.party[0] ?? null : row.party,
      }))
      setResults(normalised)
      setOpen(true)
      setLoading(false)
    }, 200)

    return () => clearTimeout(timeout)
  }, [query])

  const handleSelect = (id: string) => {
    setOpen(false)
    setQuery('')
    router.push(`/candidates/${id}`)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          placeholder={s.search.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full h-9 pl-9 pr-3 rounded-md border border-input bg-white text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
      </div>

      {open && (
        <div className="absolute top-full mt-1 w-full rounded-md border border-border bg-white shadow-lg z-50 overflow-hidden">
          {loading ? (
            <div className="p-3 text-sm text-muted-foreground">{s.search.searching}</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">{s.search.noResults}</div>
          ) : (
            <ul>
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onMouseDown={() => handleSelect(r.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left hover:bg-muted/50 transition-colors"
                  >
                    {r.party && (
                      <span
                        className="inline-flex items-center justify-center h-5 min-w-[2rem] rounded px-1 text-[10px] font-bold text-white"
                        style={{ backgroundColor: r.party.color_hex }}
                      >
                        {r.party.abbreviation}
                      </span>
                    )}
                    <span className="font-medium">{r.full_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
