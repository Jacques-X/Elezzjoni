'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { s } from '@/lib/strings'
import { FileText } from 'lucide-react'

interface BallotCandidate {
  name: string
  party: string
  partyColor: string
}

interface BallotPreviewProps {
  candidates: BallotCandidate[]
  districtName: string
}

export function BallotPreview({ candidates, districtName }: BallotPreviewProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors border border-dashed rounded-lg px-3 py-2 hover:border-border hover:bg-muted/30"
      >
        <FileText size={14} />
        {s.ballotPreview.triggerBtn}
      </DialogTrigger>

      <DialogContent className="max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{s.ballotPreview.heading}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">{districtName}</p>

        {/* Ballot paper */}
        <div
          className="rounded-sm border-2 border-gray-700 overflow-hidden font-mono text-xs"
          style={{ background: '#FFFEF2' }}
        >
          {/* Header */}
          <div className="border-b-2 border-gray-700 p-2.5 text-center space-y-1">
            <p className="font-bold uppercase tracking-widest text-[11px]">
              {s.ballotPreview.heading}
            </p>
            <p className="text-[9px] text-gray-600 leading-snug max-w-xs mx-auto">
              {s.ballotPreview.instruction}
            </p>
          </div>

          {/* Candidate rows */}
          {candidates.map((c, i) => (
            <div
              key={i}
              className="flex items-center border-b border-gray-400 last:border-b-0"
              style={{ minHeight: '40px' }}
            >
              {/* Preference box */}
              <div className="w-12 shrink-0 flex items-center justify-center border-r border-gray-400 self-stretch">
                <div className="w-7 h-7 border-2 border-gray-600 rounded-sm" />
              </div>

              {/* Party colour strip */}
              <div
                className="w-1.5 shrink-0 self-stretch"
                style={{ backgroundColor: c.partyColor }}
              />

              {/* Candidate info */}
              <div className="flex-1 px-2.5 py-1.5">
                <p className="font-bold uppercase tracking-tight text-[11px] leading-tight">
                  {c.name}
                </p>
                <p className="text-[9px] text-gray-500 mt-0.5">{c.party}</p>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div className="p-1.5 text-center text-[8px] uppercase tracking-widest text-gray-400 border-t border-gray-300">
            {s.ballotPreview.official}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">{s.ballotPreview.note}</p>

        <DialogFooter showCloseButton>
          <span />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
