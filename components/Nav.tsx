'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',         label: 'Home' },
  { href: '/meetings', label: 'Meetings' },
  { href: '/map',      label: 'Zoning Map' },
  { href: '/search',   label: 'Search' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="bg-[#0C1F3F] border-b-2 border-[#C97E0A] sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 flex items-center h-14 gap-8">
        <Link href="/" className="font-serif text-xl font-bold text-white tracking-tight shrink-0">
          Duluth <span className="text-[#C97E0A]">Now</span>
        </Link>

        <div className="flex gap-1 flex-1">
          {links.map(({ href, label }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`text-xs font-medium uppercase tracking-widest px-3.5 py-1.5 rounded transition-all duration-150 ${
                  active
                    ? 'text-white bg-white/13'
                    : 'text-white/55 hover:text-white hover:bg-white/8'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
