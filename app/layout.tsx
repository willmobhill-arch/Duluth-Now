import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/Nav'

export const metadata: Metadata = {
  title: { default: 'Duluth Now', template: '%s | Duluth Now' },
  description: 'Civic transparency platform for Duluth, GA — AI-powered meeting summaries, zoning map, and public records search.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Nav />
        <main>{children}</main>
        <footer className="mt-24 py-8 border-t border-[#D8D7D1] text-center text-xs text-[#6B7280] font-mono">
          Duluth Now — Making city government legible for everyone. &nbsp;·&nbsp; Data sourced from{' '}
          <a href="https://duluthga.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#2455A4]">
            duluthga.net
          </a>
          {' '}and public records.
        </footer>
      </body>
    </html>
  )
}
