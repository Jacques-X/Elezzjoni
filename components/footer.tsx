import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-white mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-bold tracking-tight">
              elezzjoni<span className="text-[#CF0A2C]">.</span>
              <span className="text-[#003DA5]">mt</span>
            </span>
            <p className="mt-2 text-sm text-muted-foreground">
              Politically neutral civic tech for Maltese voters.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Explore</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/districts" className="hover:text-foreground transition-colors">Districts</Link></li>
              <li><Link href="/parties" className="hover:text-foreground transition-colors">Parties</Link></li>
              <li><Link href="/candidates" className="hover:text-foreground transition-colors">Candidates</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">About</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="https://electoral.gov.mt" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Electoral Commission</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3">Data</h3>
            <p className="text-sm text-muted-foreground">
              Data is sourced from official electoral records and party publications.
              AI-generated summaries are clearly labelled.
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border/50 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Elezzjoni.mt · Open source civic technology · Not affiliated with any political party</p>
        </div>
      </div>
    </footer>
  )
}
