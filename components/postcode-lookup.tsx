'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { postcodeToDistrict } from '@/lib/postal-districts'
import { s } from '@/lib/strings'
import { MapPin } from 'lucide-react'

export function PostcodeLookup() {
  const [value, setValue]       = useState('')
  const [error, setError]       = useState(false)
  const [found, setFound]       = useState<number | null>(null)
  const router                  = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const district = postcodeToDistrict(value)
    if (district) {
      setError(false)
      setFound(district)
      router.push(`/districts/${district}`)
    } else {
      setError(true)
      setFound(null)
    }
  }

  return (
    <div>
      <p className="text-sm font-semibold mb-3">{s.postcode.heading}</p>
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setError(false); setFound(null) }}
            placeholder={s.postcode.placeholder}
            className="w-full pl-8 pr-3 h-9 rounded-lg border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
        >
          {s.postcode.button}
        </button>
      </form>
      {error && (
        <p className="mt-2 text-xs text-destructive">{s.postcode.notFound}</p>
      )}
      {found && !error && (
        <p className="mt-2 text-xs text-primary font-medium">{s.postcode.found(found)}</p>
      )}
    </div>
  )
}
