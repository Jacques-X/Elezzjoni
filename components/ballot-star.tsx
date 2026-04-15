'use client'

import { useState, useEffect } from 'react'
import { Star } from 'lucide-react'
import { toggleStar, isStarred } from '@/lib/ballot'

export function BallotStar({ candidateId }: { candidateId: string }) {
  const [starred, setStarred] = useState(false)

  useEffect(() => {
    setStarred(isStarred(candidateId))
  }, [candidateId])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggleStar(candidateId)
    setStarred(p => !p)
  }

  return (
    <button
      onClick={handleClick}
      aria-label={starred ? 'Neħħi mill-ballotta' : 'Żid mal-ballotta'}
      className="p-1.5 rounded-lg hover:bg-black/5 transition-colors shrink-0"
    >
      <Star
        size={14}
        className={starred ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40 hover:text-muted-foreground'}
      />
    </button>
  )
}
