import { DashboardShell } from '@/components/dashboard-shell'
import { ArrowUpRight, FileText, Send, BarChart3, BellRing } from 'lucide-react'

const VAULT_URL = 'https://grovlabs-vault.onrender.com'

/** Billing moved to the GrovLabs Vault (invoices, publisher payouts, reminders, profit). This page just points there. */
export default function BillingPage() {
  const items = [
    { icon: FileText, title: 'Buyer invoices', text: 'Filled from TrackDrive, PDFs, emailed from accounting@, payments and disputes.', href: '/invoices' },
    { icon: Send, title: 'Publisher payouts', text: 'Built per pay cycle from TrackDrive, payout statements emailed with a CSV of every call.', href: '/payouts' },
    { icon: BellRing, title: 'Reminders', text: 'Due-soon, due-today and overdue reminders to buyers.', href: '/reminders' },
    { icon: BarChart3, title: 'Profit', text: 'Revenue minus payouts minus running costs, month by month.', href: '/profit' },
  ]
  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl py-10">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">Billing has moved</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Invoices and payouts now live in the Vault</h1>
        <p className="mt-3 text-muted-foreground">
          One place for money in and money out, so the numbers never disagree. Nothing here is used any more.
        </p>
        <a href={VAULT_URL} target="_blank" rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground hover:opacity-90">
          Open the Vault <ArrowUpRight className="h-4 w-4" />
        </a>
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, text, href }) => (
            <a key={title} href={`${VAULT_URL}${href}`} target="_blank" rel="noreferrer"
              className="group rounded-xl border p-5 transition-colors hover:border-primary/50 hover:bg-muted/40">
              <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" />{title}
                <ArrowUpRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </a>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
