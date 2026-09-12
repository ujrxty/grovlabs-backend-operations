'use client'

import { ReactNode, useState } from 'react'
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
  Settings,
  Users,
  Award,
  Target,
  Map,
  Clock,
  Gauge,
  Lightbulb,
  AlertTriangle,
  ChevronDown,
  BarChart3,
  Shield,
  Activity
} from 'lucide-react'

const navGroups = [
  {
    label: 'Live',
    icon: Activity,
    defaultOpen: true,
    items: [
      { href: '/rtb-intelligence', label: 'Overview', icon: Radio },
      { href: '/rtb-intelligence/live', label: 'Live Feed', icon: Zap },
      { href: '/rtb-intelligence/ping-flow', label: 'Ping Flow', icon: Target },
    ]
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { href: '/rtb-intelligence/trends', label: 'Trends', icon: TrendingUp },
      { href: '/rtb-intelligence/offers', label: 'By Offer', icon: Package },
      { href: '/rtb-intelligence/sources', label: 'By Source', icon: Globe },
      { href: '/rtb-intelligence/coverage', label: 'Coverage', icon: MapPin },
      { href: '/rtb-intelligence/bids', label: 'Bids', icon: DollarSign },
      { href: '/rtb-intelligence/bid-distribution', label: 'Bid Spread', icon: TrendingUp },
    ]
  },
  {
    label: 'Performance',
    icon: Gauge,
    defaultOpen: false,
    items: [
      { href: '/rtb-intelligence/buyers', label: 'Buyer Leaderboard', icon: Award },
      { href: '/rtb-intelligence/publishers', label: 'Publisher Quality', icon: Users },
      { href: '/rtb-intelligence/latency', label: 'Latency', icon: Gauge },
      { href: '/rtb-intelligence/opportunities', label: 'Opportunities', icon: Lightbulb },
    ]
  },
  {
    label: 'Quality',
    icon: Shield,
    defaultOpen: false,
    items: [
      { href: '/rtb-intelligence/fraud', label: 'Fraud Detection', icon: AlertTriangle },
      { href: '/rtb-intelligence/duplicates', label: 'Duplicates', icon: Copy },
      { href: '/rtb-intelligence/rejections', label: 'Rejections', icon: XCircle },
      { href: '/rtb-intelligence/anomalies', label: 'Anomalies', icon: AlertTriangle },
    ]
  },
  {
    label: 'Heatmaps',
    icon: Map,
    defaultOpen: false,
    items: [
      { href: '/rtb-intelligence/geo-heatmap', label: 'Geographic', icon: Map },
      { href: '/rtb-intelligence/time-heatmap', label: 'Time of Day', icon: Clock },
    ]
  },
  {
    label: 'Settings',
    icon: Settings,
    defaultOpen: false,
    items: [
      { href: '/rtb-intelligence/alerts', label: 'Alert Rules', icon: Bell },
      { href: '/rtb-intelligence/relay', label: 'Relay Config', icon: Settings },
    ]
  },
]

function NavGroup({
  group,
  pathname,
  isOpen,
  onToggle
}: {
  group: typeof navGroups[0]
  pathname: string
  isOpen: boolean
  onToggle: () => void
}) {
  const hasActiveItem = group.items.some(item => pathname === item.href)
  const Icon = group.icon

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
          hasActiveItem
            ? 'bg-lime-500/10 text-lime-500'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          {group.label}
        </span>
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="mt-1 ml-3 pl-3 border-l border-muted space-y-0.5">
          {group.items.map((item) => {
            const isActive = pathname === item.href
            const ItemIcon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors',
                  isActive
                    ? 'bg-lime-500/20 text-lime-500 font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                )}
              >
                <ItemIcon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function RTBLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    navGroups.forEach(g => {
      initial[g.label] = g.defaultOpen || g.items.some(item => pathname === item.href)
    })
    return initial
  })

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <DashboardShell>
      <RTBFilterProvider>
        <div className="flex h-full">
          <aside className="w-56 border-r bg-muted/10 flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-lime-500" />
                <span className="font-bold">RTB Intelligence</span>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navGroups.map((group) => (
                <NavGroup
                  key={group.label}
                  group={group}
                  pathname={pathname}
                  isOpen={openGroups[group.label] ?? false}
                  onToggle={() => toggleGroup(group.label)}
                />
              ))}
            </nav>
          </aside>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </RTBFilterProvider>
    </DashboardShell>
  )
}
