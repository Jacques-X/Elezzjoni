'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/strings'

/**
 * Simplified schematic SVG of Malta's 13 electoral districts.
 *
 * Paths are topologically correct approximations — each district is roughly
 * in the right geographic position.  For pixel-perfect boundaries, replace
 * these `d` strings with paths generated from the Electoral Commission's
 * official GeoJSON via: npx mapshaper districts.geojson -proj wgs84 -o format=svg
 */

interface DistrictPath {
  id: number
  name: string
  d: string
  labelX: number
  labelY: number
}

// ViewBox: 0 0 540 320
// Gozo (D13): top-left separate island
// Malta main island: x≈148–530, y≈65–310
const DISTRICTS: DistrictPath[] = [
  // ── North (D6 — Mellieħa / St Paul's Bay) ──────────────
  {
    id: 6, name: "Mellieħa",
    d: 'M 148,65 L 370,65 L 370,155 L 218,155 L 165,148 L 148,120 Z',
    labelX: 258, labelY: 112,
  },
  // ── NE coast (D5 — Sliema / St Julian's) ───────────────
  {
    id: 5, name: "Sliema",
    d: 'M 370,65 L 510,70 L 522,108 L 520,155 L 370,155 Z',
    labelX: 450, labelY: 112,
  },
  // ── Upper-center (D4 — Naxxar / Mosta / San Ġwann) ─────
  {
    id: 4, name: "Naxxar",
    d: 'M 218,155 L 312,155 L 312,240 L 218,245 Z',
    labelX: 265, labelY: 198,
  },
  // ── Center (D3 — Birkirkara / Lija / Attard / Balzan) ──
  {
    id: 3, name: "Birkirkara",
    d: 'M 312,155 L 370,155 L 370,245 L 312,240 Z',
    labelX: 341, labelY: 198,
  },
  // ── Center-east (D2 — Msida / Gżira / Ta' Xbiex) ───────
  {
    id: 2, name: "Msida",
    d: 'M 370,155 L 446,155 L 446,240 L 370,245 Z',
    labelX: 408, labelY: 198,
  },
  // ── Far east (D1 — Valletta / Floriana / Ħamrun / Marsa)
  {
    id: 1, name: "Valletta",
    d: 'M 446,155 L 520,155 L 530,200 L 524,245 L 446,240 Z',
    labelX: 486, labelY: 198,
  },
  // ── West (D7 — Rabat / Mdina / Dingli) ─────────────────
  {
    id: 7, name: "Rabat",
    d: 'M 148,120 L 165,148 L 218,155 L 218,245 L 162,256 L 145,232 Z',
    labelX: 176, labelY: 196,
  },
  // ── Center-south (D8 — Qormi / Żebbuġ) ────────────────
  {
    id: 8, name: "Qormi",
    d: 'M 218,245 L 312,240 L 330,255 L 325,308 L 248,308 L 218,292 Z',
    labelX: 272, labelY: 278,
  },
  // ── SW (D9 — Żurrieq / Qrendi / Kirkop) ────────────────
  {
    id: 9, name: "Żurrieq",
    d: 'M 145,232 L 162,256 L 218,245 L 218,292 L 196,312 L 148,302 Z',
    labelX: 175, labelY: 278,
  },
  // ── Center-east lower (D11 — Paola / Tarxien / Fgura) ──
  {
    id: 11, name: "Paola",
    d: 'M 312,240 L 370,245 L 390,260 L 386,310 L 326,312 L 325,308 L 330,255 Z',
    labelX: 355, labelY: 278,
  },
  // ── East lower (D12 — Żabbar / Marsaskala) ─────────────
  {
    id: 12, name: "Żabbar",
    d: 'M 370,245 L 446,240 L 455,258 L 450,310 L 386,312 L 390,260 Z',
    labelX: 420, labelY: 278,
  },
  // ── SE (D10 — Birżebbuġa / Żejtun / Marsaxlokk) ────────
  {
    id: 10, name: "Birżebbuġa",
    d: 'M 446,240 L 524,245 L 530,278 L 494,312 L 450,312 L 455,258 Z',
    labelX: 490, labelY: 278,
  },
  // ── Gozo (D13) ──────────────────────────────────────────
  {
    id: 13, name: "Għawdex",
    d: 'M 8,12 L 115,10 L 128,44 L 114,88 L 62,100 L 8,78 Z',
    labelX: 68, labelY: 55,
  },
]

// Muted base + hover shade per district (uses party-neutral palette)
const DISTRICT_COLORS: Record<number, string> = {
  1: '#DBEAFE', 2: '#D1FAE5', 3: '#FEF9C3', 4: '#FFE4E6',
  5: '#EDE9FE', 6: '#CCFBF1', 7: '#FEF3C7', 8: '#FCE7F3',
  9: '#E0F2FE', 10: '#F0FDF4', 11: '#FFF7ED', 12: '#F5F3FF',
  13: '#ECFDF5',
}
const HOVER_COLORS: Record<number, string> = {
  1: '#BFDBFE', 2: '#A7F3D0', 3: '#FDE68A', 4: '#FECDD3',
  5: '#DDD6FE', 6: '#99F6E4', 7: '#FDE68A', 8: '#FBCFE8',
  9: '#BAE6FD', 10: '#BBF7D0', 11: '#FED7AA', 12: '#E9D5FF',
  13: '#A7F3D0',
}

interface MaltaMapProps {
  highlightId?: number
  className?: string
}

export function MaltaMap({ highlightId, className = '' }: MaltaMapProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const router = useRouter()

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-2">{s.map.tapDistrict}</p>
      <svg
        viewBox="0 0 540 320"
        className="w-full touch-manipulation select-none"
        role="img"
        aria-label={s.map.ariaLabel}
      >
        {DISTRICTS.map(({ id, name, d, labelX, labelY }) => {
          const isHighlighted = id === highlightId
          const isHovered     = id === hovered
          const fill = isHighlighted
            ? HOVER_COLORS[id]
            : isHovered
            ? HOVER_COLORS[id]
            : DISTRICT_COLORS[id]

          return (
            <g
              key={id}
              onClick={() => router.push(`/districts/${id}`)}
              onMouseEnter={() => setHovered(id)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <path
                d={d}
                fill={fill}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
                className="transition-colors duration-150"
              />
              {/* District number label */}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="9"
                fontWeight="600"
                fill="#374151"
                className="pointer-events-none"
              >
                {id}
              </text>
            </g>
          )
        })}

        {/* Water gap between Gozo and Malta */}
        <ellipse cx="138" cy="55" rx="8" ry="12" fill="#EFF6FF" opacity="0.6" />
      </svg>

      {/* District name tooltip */}
      {hovered && (
        <p className="text-xs text-center text-muted-foreground mt-1">
          {DISTRICTS.find(d => d.id === hovered)?.name} — Distrett {hovered}
        </p>
      )}
    </div>
  )
}
