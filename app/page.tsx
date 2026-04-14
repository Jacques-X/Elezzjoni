import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { MapPin, Users, Building2, ArrowRight } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { count: candidateCount },
    { data: parties },
  ] = await Promise.all([
    supabase.from('candidates').select('*', { count: 'exact', head: true }),
    supabase.from('parties').select('id, name, abbreviation, color_hex').order('abbreviation'),
  ])

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-[#CF0A2C]/5 via-transparent to-[#003DA5]/5 pointer-events-none" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="flex gap-2 mb-6">
              <span className="h-2 w-8 rounded-full bg-[#CF0A2C]" />
              <span className="h-2 w-8 rounded-full bg-white border border-border" />
              <span className="h-2 w-8 rounded-full bg-[#003DA5]" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Know your candidates.<br />
              <span className="text-muted-foreground font-normal">Vote with confidence.</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">
              A politically neutral portal to find, research, and compare candidates
              running in all 13 Maltese electoral districts.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/districts" className={cn(buttonVariants({ size: 'lg' }))}>
                Browse by District <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/candidates" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
                All Candidates
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/50 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatCard icon={<MapPin className="h-5 w-5" />} value="13" label="Electoral Districts" />
            <StatCard icon={<Users className="h-5 w-5" />} value={candidateCount?.toString() ?? '—'} label="Candidates" />
            <StatCard icon={<Building2 className="h-5 w-5" />} value={parties?.length?.toString() ?? '—'} label="Parties" />
            <StatCard icon={<MapPin className="h-5 w-5" />} value="1" label="Gozo Constituency" />
          </div>
        </div>
      </section>

      {/* Quick navigation */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold mb-8">Quick Access</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <NavCard
            href="/districts"
            title="Find by District"
            description="Browse all 13 electoral districts and see every candidate on the ballot in your area."
            accent="#CF0A2C"
            icon={<MapPin className="h-6 w-6" />}
          />
          <NavCard
            href="/parties"
            title="Explore Parties"
            description="See party profiles, their full candidate rosters, and filter by affiliation."
            accent="#003DA5"
            icon={<Building2 className="h-6 w-6" />}
          />
          <NavCard
            href="/candidates"
            title="All Candidates"
            description="Search and filter the complete directory of candidates across all districts."
            accent="#6B7280"
            icon={<Users className="h-6 w-6" />}
          />
        </div>
      </section>

      {/* Parties */}
      {parties && parties.length > 0 && (
        <section className="border-t border-border/50 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold mb-8">Parties on the Ballot</h2>
            <div className="flex flex-wrap gap-3">
              {parties.map((party) => (
                <Link key={party.id} href={`/parties/${party.id}`}>
                  <Badge
                    variant="outline"
                    className="px-4 py-2 text-sm font-semibold cursor-pointer hover:opacity-90 transition-opacity border-0 text-white"
                    style={{ backgroundColor: party.color_hex }}
                  >
                    {party.abbreviation} · {party.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-muted-foreground">{icon}</div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

function NavCard({
  href,
  title,
  description,
  accent,
  icon,
}: {
  href: string
  title: string
  description: string
  accent: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full p-6 border-border/60 hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden relative">
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: accent }}
        />
        <div className="mb-3" style={{ color: accent }}>{icon}</div>
        <h3 className="font-semibold text-base mb-2 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-4 flex items-center text-sm font-medium" style={{ color: accent }}>
          Explore <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </div>
      </Card>
    </Link>
  )
}
