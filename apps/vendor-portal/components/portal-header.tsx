'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { FileText, Search, Home } from 'lucide-react'

const navItems = [
  { href: '/', label: 'Campaigns', icon: Home },
  { href: '/status', label: 'Check Status', icon: Search },
]

export function PortalHeader() {
  const pathname = usePathname() ?? '/'

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-purple-100">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative h-10 w-28">
            <Image
              src="https://cdn.abacus.ai/images/72bde599-aaeb-47a2-9634-5b3eb5e84267.png"
              alt="The Broken Wood Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="hidden sm:inline-block text-sm font-medium text-purple-700 border-l border-purple-200 pl-3">Vendor Portal</span>
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
                    ? 'bg-purple-100 text-purple-800'
                    : 'text-gray-600 hover:bg-purple-50 hover:text-purple-700'
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
