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
    <header className="sticky top-0 z-50 w-full bg-[#faf8f5]/90 backdrop-blur-md border-b border-[#b87333]/10">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-8 w-8 place-items-center rounded-[3px] bg-[#1a1a1a] font-mono text-[11px] font-medium text-[#faf8f5]">
            TBW
          </span>
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">The Broken Wood</span>
          <span className="hidden sm:inline-block text-sm font-medium text-[#b87333] border-l border-[#b87333]/20 pl-3">Vendor Portal</span>
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
                    ? 'bg-[#b87333]/10 text-[#b87333]'
                    : 'text-[#1a1a1a]/70 hover:bg-[#b87333]/5 hover:text-[#b87333]'
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
