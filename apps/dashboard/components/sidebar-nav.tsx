'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  FileText,
  PhoneCall,
  LogOut,
  Receipt,
  PhoneOff,
  Siren,
  ClipboardCheck,
  Megaphone,
  Settings,
  UsersRound,
  ScrollText,
  Sliders,
  Network,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/applications', label: 'Applications', icon: FileText },
  { href: '/vendors', label: 'Vendors', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/insertion-orders', label: 'Insertion Orders', icon: FileText },
  { href: '/network-partners', label: 'Network Partners', icon: Network },
  { href: '/call-qa', label: 'Call QA Logs', icon: PhoneCall },
  { href: '/qa-settings', label: 'QA Settings', icon: Sliders },
  { href: '/non-conversion-qa', label: 'Non-Conversion QA', icon: PhoneOff },
  { href: '/sales-monitoring', label: 'Sales Monitoring', icon: ClipboardCheck },
  { href: '/loss-monitor', label: 'Loss Monitor', icon: Siren },
  { href: '/billing', label: 'Billing', icon: Receipt },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/team', label: 'Team', icon: UsersRound },
  { href: '/settings/templates', label: 'Templates', icon: ScrollText },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-2 py-3 mb-4">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-[#050505] border border-white/10">
          <span className="text-white font-extrabold text-lg" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>G</span>
          <span className="absolute bottom-1.5 right-1.5 h-2 w-2 rounded-full bg-[#c4ff00]" />
        </div>
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-white">GrovLabs</h2>
          <p className="text-[11px] text-white/50 leading-none">Admin Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems?.map((item: any) => {
          const isActive = pathname === item?.href || (item?.href !== '/' && item?.href !== '/settings' && pathname?.startsWith?.(item?.href))
          const Icon = item?.icon
          return (
            <Link
              key={item?.href}
              href={item?.href ?? '/'}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#a3e635]/10 text-[#a3e635]'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              {item?.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t pt-3 mt-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
