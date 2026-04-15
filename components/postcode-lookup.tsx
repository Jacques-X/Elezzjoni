'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { postcodeToDistrict, districtName } from '@/lib/postal-districts'
import { s } from '@/lib/strings'
import { MapPin, ArrowRight } from 'lucide-react'

export function PostcodeLookup() {
  const [value, setValue]     = useState('')
  const [districtId, setDistrictId] = useState<number | null>(null)
  const [notFound, setNotFound]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function check(raw: string) {
    setValue(raw)
    setNotFound(false)

    // Attempt live lookup once ≥3 letters are present
    const normalised = raw.trim().toUpperCase().replace(/\s+/g, '')
    if (normalised.length >= 3) {
      const id = postcodeToDistrict(normalised)
      setDistrictId(id)
    } else {
      setDistrictId(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const id = postcodeToDistrict(value)
    if (id) {
      setDistrictId(id)
      setNotFound(false)
    } else {
      setDistrictId(null)
      setNotFound(true)
    }
  }

  const name = districtId ? districtName(districtId) : null

  return (
    <div>
      <p className="font-semibold mb-1">{s.postcode.heading}</p>
      <p className="text-sm text-muted-foreground mb-4">
        Daħħal il-kodiċi postali tiegħek biex issib id-distrett elettorali tiegħek.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <MapPin
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            ref={inputRef}
            value={value}
            onChange={e => check(e.target.value)}
            placeholder={s.postcode.placeholder}
            maxLength={8}
            autoComplete="postal-code"
            className="w-full pl-8 pr-3 h-10 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 uppercase tracking-wide"
          />
        </div>
        <button
          type="submit"
          className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          {s.postcode.button}
        </button>
      </form>

      {/* Result */}
      {districtId && name && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={14} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground leading-none mb-0.5">Distrett {districtId}</p>
              <p className="text-sm font-semibold truncate">{name}</p>
            </div>
          </div>
          <Link
            href={`/districts/${districtId}`}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4 shrink-0"
          >
            Ara <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Not found */}
      {notFound && !districtId && (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive font-medium">{s.postcode.notFound}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Eżempji: VLT 1000 (Valletta), SLM 3000 (Sliema), MST 2000 (Mosta)
          </p>
        </div>
      )}
    </div>
  )
}
