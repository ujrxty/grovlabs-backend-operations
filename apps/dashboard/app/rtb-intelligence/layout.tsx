'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { RTBFilterProvider } from '@/components/rtb/rtb-filter-context'
import { DashboardShell } from '@/components/dashboard-shell'
import { cn } from '@/lib/utils'
import {
  Radio,
  Zap,
  TrendingUp,
  Package,
  Globe,
  MapPin,
  Copy,
  XCircle,
  DollarSign,
  Bell,
  Settings
} from 'lucide-react'

const navItems = [
  { href: '/rtb-intelligence', label: 'Overview', icon: Radio },
  { href: '/rtb-intelligence/live', label: 'Live', icon: Zap },
  { href: '/rtb-intelligence/trends', label: 'Trends', icon: TrendingUp },
  { href: '/rtb-intelligence/offers', label: 'Offers', icon: Package },
  { href: '/rtb-intelligence/sources', label: 'Sources', icon: Globe },
  { href: '/rtb-intelligence/coverage', label: 'Coverage', icon: MapPin },
  { href: '/rtb-intelligence/duplicates', label: 'Duplicates', icon: Copy },
  { href: '/rtb-intelligence/rejections', label: 'Rejections', icon: XCircle },
  { href: '/rtb-intelligence/bids', label: 'Bids', icon: DollarSign },
  { href: '/rtb-intelligence/alerts', label: 'Alerts', icon: Bell },
  { href: '/rtb-intelligence/relay', label: 'Relay', icon: Settings },
]

export default function RTBLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <DashboardShell>
      <RTBFilterProvider>
        <div className="h-full overflow-auto">
          <div className="border-b bg-muted/20 px-6 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <Radio className="h-6 w-6 text-lime-500" />
              <h1 className="text-xl font-bold">RTB Intelligence</h1>
            </div>
            <nav className="flex gap-1 overflow-x-auto pb-0">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-2 text-sm rounded-t-md transition-colors whitespace-nowrap border-b-2',
                      isActive
                        ? 'bg-background border-lime-500 text-lime-500 font-medium'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </RTBFilterProvider>
    </DashboardShell>
  )
}
