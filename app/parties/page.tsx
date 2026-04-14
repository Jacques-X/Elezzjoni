import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, Building2 } from 'lucide-react'

export const metadata = {
  title: 'Parties — Elezzjoni.mt',
  description: 'Explore all political parties contesting the Malta elections.',
}

export default async function PartiesPage() {
  const supabase = await createClient()

  const { data: parties } = await supabase
    .from('parties')
    .select('*')
    .order('abbreviation')

  // Candidate count per party
  const { data: candidates } = await supabase
    .from('candidates')
    .select('party_id')

  const countByParty: Record<string, number> = {}
  candidates?.forEach((c) => {
    if (c.party_id) {
      countByParty[c.party_id] = (countByParty[c.party_id] ?? 0) + 1
    }
  })

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span>Parties</span>
      </div>

      <div className="mb-10">
        <h1 className="text-3xl font-bold">Political Parties</h1>
        <p className="mt-2 text-muted-foreground">
          All parties contesting the election. Select a party to see their candidates.
        </p>
      </div>

      {parties && parties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {parties.map((party) => (
            <Link key={party.id} href={`/parties/${party.id}`} className="group block">
              <Card className="h-full overflow-hidden border-border/60 hover:shadow-md transition-all hover:-translate-y-0.5 p-0">
                {/* Colour band */}
                <div className="h-2 w-full" style={{ backgroundColor: party.color_hex }} />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {party.logo_url ? (
                        <Image
                          src={party.logo_url}
                          alt={`${party.name} logo`}
                          width={40}
                          height={40}
                          className="rounded object-contain"
                        />
                      ) : (
                        <div
                          className="h-10 w-10 rounded flex items-center justify-center text-white font-bold text-sm"
                          style={{ backgroundColor: party.color_hex }}
                        >
                          {party.abbreviation}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-base group-hover:text-primary transition-colors">
                          {party.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{party.abbreviation}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold">{countByParty[party.id] ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground">candidates</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center text-sm text-muted-foreground group-hover:text-primary transition-colors">
                    View roster <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-16">No parties loaded yet.</p>
      )}
    </div>
  )
}
