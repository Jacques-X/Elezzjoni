import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Elezzjoni.mt — Malta Election Portal',
  description:
    'Find, research, and compare electoral candidates in your district. Politically neutral civic tech for Maltese voters.',
  openGraph: {
    title: 'Elezzjoni.mt',
    description: 'Malta Election Candidate Portal',
    locale: 'mt_MT',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="mt" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAFAFA] text-foreground">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
