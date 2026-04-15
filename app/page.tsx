import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PostcodeLookup } from '@/components/postcode-lookup'
import { MaltaMap } from '@/components/malta-map'
import { cn } from '@/lib/utils'
import { s } from '@/lib/strings'
import { MapPin, Users, Building2, ArrowRight, BookOpen } from 'lucide-react'

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
              <span className="h-2 w-8 rounded-full bg-white border border-border" />
              <span className="h-2 w-8 rounded-full bg-[#CF0A2C]" />
              <span className="h-2 w-8 rounded-full bg-white border border-border" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              {s.home.heroHeading}<br />
              <span className="text-muted-foreground font-normal">{s.home.heroSubheading}</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-xl">{s.home.heroDescription}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/districts" className={cn(buttonVariants({ size: 'lg' }))}>
                {s.home.ctaBrowse} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/candidates" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
                {s.home.ctaAll}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border/50 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-3 gap-6">
            <StatCard icon={<MapPin className="h-5 w-5" />}    value="13"                                  label={s.home.statDistricts}  />
            <StatCard icon={<Users className="h-5 w-5" />}     value={candidateCount?.toString() ?? '—'}   label={s.home.statCandidates} />
            <StatCard icon={<Building2 className="h-5 w-5" />} value={parties?.length?.toString() ?? '—'} label={s.home.statParties}    />
          </div>
        </div>
      </section>

      {/* Map + Postcode — two-column on desktop */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: map */}
          <div>
            <h2 className="text-2xl font-bold mb-1">{s.home.card1Title}</h2>
            <p className="text-sm text-muted-foreground mb-6">{s.home.card1Desc}</p>
            <MaltaMap className="max-w-sm" />
          </div>
          {/* Right: postcode lookup + quick access */}
          <div className="space-y-10">
            <div className="bg-white border border-border/60 rounded-xl p-6 shadow-sm">
              <PostcodeLookup />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-6">{s.home.quickAccessTitle}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NavCard href="/parties"    title={s.home.card2Title} description={s.home.card2Desc} accent="#003DA5" icon={<Building2 className="h-5 w-5" />} />
                <NavCard href="/candidates" title={s.home.card3Title} description={s.home.card3Desc} accent="#6B7280" icon={<Users className="h-5 w-5" />} />
                <NavCard href="/ballot"     title={s.nav.ballot}      description={s.ballot.subheading}   accent="#F59E0B" icon={<MapPin className="h-5 w-5" />} />
                <NavCard href="/stv"        title={s.stv.heading}     description="Tgħallem kif taħdem is-STV b'animazzjoni interattiva." accent="#8B5CF6" icon={<BookOpen className="h-5 w-5" />} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Parties */}
      {parties && parties.length > 0 && (
        <section className="border-t border-border/50 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
            <h2 className="text-2xl font-bold mb-8">{s.home.partiesTitle}</h2>
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

function NavCard({ href, title, description, accent, icon }: {
  href: string; title: string; description: string; accent: string; icon: React.ReactNode
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full p-5 border-border/60 hover:shadow-md transition-all hover:-translate-y-0.5 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: accent }} />
        <div className="mb-2.5" style={{ color: accent }}>{icon}</div>
        <h3 className="font-semibold text-sm mb-1.5 group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{description}</p>
        <div className="mt-3 flex items-center text-xs font-medium" style={{ color: accent }}>
          {s.home.cardCta} <ArrowRight className="ml-1 h-3 w-3" />
        </div>
      </Card>
    </Link>
  )
}
