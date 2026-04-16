import Link from 'next/link'
import { s } from '@/lib/strings'

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-white mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-bold tracking-tight">
              kandidati<span className="text-[#003DA5]">.</span>
              <span className="text-[#CF0A2C]">mt</span>
            </span>
            <p className="mt-2 text-sm text-muted-foreground">{s.site.tagline}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{s.footer.explore}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/districts" className="hover:text-foreground transition-colors">{s.nav.districts}</Link></li>
              <li><Link href="/parties"   className="hover:text-foreground transition-colors">{s.nav.parties}</Link></li>
              <li><Link href="/candidates"className="hover:text-foreground transition-colors">{s.nav.candidates}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{s.footer.about}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="https://electoral.gov.mt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
                  {s.footer.electoralCommission}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">{s.footer.data}</h3>
            <p className="text-sm text-muted-foreground">{s.footer.dataNote}</p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border/50 text-xs text-muted-foreground">
          <p>{s.site.copyright(new Date().getFullYear())}</p>
        </div>
      </div>
    </footer>
  )
}
