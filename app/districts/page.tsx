import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, ArrowRight } from 'lucide-react'

export const metadata = {
  title: 'Districts — Elezzjoni.mt',
  description: 'Browse all 13 electoral districts in Malta and find candidates in your area.',
}

export default async function DistrictsPage() {
  const supabase = await createClient()

  const { data: districts } = await supabase
    .from('districts')
    .select('*')
    .order('id')

  // Candidate counts per district
  const { data: candidates } = await supabase
    .from('candidates')
    .select('districts')

  const countByDistrict: Record<number, number> = {}
  candidates?.forEach((c) => {
    c.districts?.forEach((d: number) => {
      countByDistrict[d] = (countByDistrict[d] ?? 0) + 1
    })
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span>Districts</span>
        </div>
        <h1 className="text-3xl font-bold">Electoral Districts</h1>
        <p className="mt-2 text-muted-foreground">
          Malta is divided into 13 electoral districts. Select a district to see all candidates.
        </p>
      </div>

      {/* Special note for Gozo */}
      <div className="mb-8 rounded-lg border border-border/60 bg-white p-4 flex items-start gap-3">
        <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">District 13</strong> covers the entire island of Gozo and Comino.
        </p>
      </div>

      {/* District grid */}
      {districts && districts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {districts.map((district) => (
            <Link key={district.id} href={`/districts/${district.id}`} className="group block">
              <Card className="h-full p-5 border-border/60 hover:shadow-md transition-all hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      District {district.id}
                    </span>
                    <h2 className="text-lg font-bold mt-0.5 group-hover:text-primary transition-colors">
                      {district.name}
                    </h2>
                  </div>
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <span className="text-2xl font-bold">
                      {countByDistrict[district.id] ?? 0}
                    </span>
                    <span className="text-[10px] text-muted-foreground">candidates</span>
                  </div>
                </div>

                {district.localities && district.localities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {district.localities.slice(0, 4).map((loc: string) => (
                      <Badge key={loc} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {loc}
                      </Badge>
                    ))}
                    {district.localities.length > 4 && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        +{district.localities.length - 4} more
                      </Badge>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center text-sm text-muted-foreground group-hover:text-primary transition-colors">
                  View candidates <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-16">No districts loaded yet.</p>
      )}
    </div>
  )
}
