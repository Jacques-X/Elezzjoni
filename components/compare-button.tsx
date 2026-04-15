'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftRight } from 'lucide-react'
import { getComparePick, setComparePick } from '@/lib/ballot'

interface CompareButtonProps {
  candidateId: string
  candidateName: string
}

export function CompareButton({ candidateId, candidateName }: CompareButtonProps) {
  const [pickId, setPickId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    setPickId(getComparePick())
    // Sync across cards on the same page via storage event
    function onStorage() { setPickId(getComparePick()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    const current = getComparePick()

    if (!current) {
      setComparePick(candidateId)
      setPickId(candidateId)
    } else if (current === candidateId) {
      setComparePick(null)
      setPickId(null)
    } else {
      setComparePick(null)
      setPickId(null)
      router.push(`/compare?a=${current}&b=${candidateId}`)
    }
  }

  const isPicked   = pickId === candidateId
  const isWaiting  = pickId !== null && pickId !== candidateId

  return (
    <button
      onClick={handleClick}
      title={
        isPicked  ? `Ikkanċella — ${candidateName} magħżul` :
        isWaiting ? `Qabbel ma' ${candidateName}` :
        'Qabbel ma\' kandidat ieħor'
      }
      className={[
        'p-1.5 rounded-lg transition-colors shrink-0',
        isPicked
          ? 'text-primary bg-primary/10'
          : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-black/5',
      ].join(' ')}
    >
      <ArrowLeftRight size={14} />
    </button>
  )
}
