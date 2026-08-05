'use client'

import { AppShell } from '@/components/layouts/app-shell'
import { SidebarNav } from '@/components/sidebar-nav'
import { useSession } from 'next-auth/react'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession() || {}

  return (
    <AppShell
      sidebar={<SidebarNav />}
      header={
        <div className="flex items-center justify-between w-full">
          <div />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {session?.user?.name ?? session?.user?.email ?? 'Admin'}
            </span>
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  )
}
