'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Search, Home } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Campaigns', icon: Home },
  { href: '/status', label: 'Check Status', icon: Search },
]

export function PortalHeader() {
  const pathname = usePathname() ?? '/'

  return (
    <header className="sticky top-0 z-50 w-full bg-[#050505]/90 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-bold text-[20px] text-white">
            GrovLabs<span className="text-[#c4ff00]">.</span>
          </span>
          <span className="hidden sm:inline-block text-sm font-medium text-[#c4ff00]/70 border-l border-white/10 pl-3">Vendor Portal</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems?.map((item: any) => {
            const Icon = item?.icon
            const isActive = pathname === item?.href || (item?.href !== '/' && pathname?.startsWith?.(item?.href))
            return (
              <Link
                key={item?.href}
                href={item?.href ?? '/'}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#c4ff00]/10 text-[#c4ff00]'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span className="hidden sm:inline">{item?.label ?? ''}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
