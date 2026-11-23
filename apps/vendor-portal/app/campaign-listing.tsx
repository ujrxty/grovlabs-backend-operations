'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Search, MapPin, Clock, Timer, CheckCircle2, Briefcase, ArrowRight, ChevronDown,
  ShieldCheck, FileSignature, PhoneCall, Rocket, ClipboardList, X, ArrowUpDown,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  payout: string
  payout_display: string | null
  payout_type: string
  geographic_focus: string | null
  min_duration: number | null
  requirements: string | null
  description: string | null
  hours?: string | null
}

const STEPS = [
  { icon: ClipboardList, title: 'Apply', text: 'Pick campaigns, tell us about your traffic.' },
  { icon: ShieldCheck, title: 'Vetting', text: 'We check your sources, site and compliance.' },
  { icon: FileSignature, title: 'Sign IO', text: 'Terms, payout and caps in writing.' },
  { icon: PhoneCall, title: 'Test calls', text: 'Capped test run, calls reviewed.' },
  { icon: Rocket, title: 'Go live', text: 'Caps open up. Paid biweekly, Net 15.' },
]

// "Inbound calls from... Call types: A, B, C." -> { summary, callTypes: [A, B, C] }
function splitDescription(desc: string | null) {
  const d = desc ?? ''
  const i = d.indexOf('Call types:')
  if (i === -1) return { summary: d, callTypes: [] as string[] }
  return {
    summary: d.slice(0, i).trim(),
    callTypes: d.slice(i + 11).replace(/\.$/, '').split(',').map((s) => s.trim()).filter(Boolean),
  }
}

// Highest number in "$30 to $115" (for sorting)
const topPayout = (c: Campaign) => {
  const nums = (c.payout_display ?? '').match(/\d+(\.\d+)?/g)?.map(Number) ?? []
  return nums.length ? Math.max(...nums) : Number(c.payout) || 0
}

export function CampaignListing({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('All')
  const [sort, setSort] = useState<'payout' | 'name'>('payout')

  const safe = campaigns ?? []
  const industries = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of safe) counts.set(c.industry, (counts.get(c.industry) ?? 0) + 1)
    return [['All', safe.length] as [string, number], ...Array.from(counts.entries()).sort((a, b) => b[1] - a[1])]
  }, [safe])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return safe
      .filter((c) => industry === 'All' || c.industry === industry)
      .filter((c) => !q || `${c.name} ${c.industry} ${c.description ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => (sort === 'payout' ? topPayout(b) - topPayout(a) : a.name.localeCompare(b.name)))
  }, [safe, query, industry, sort])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const apply = () => {
    if (selected.size) router.push(`/apply?campaigns=${Array.from(selected).join(',')}`)
  }

  if (safe.length === 0) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-16 text-center py-16">
        <Briefcase className="h-12 w-12 text-[#c4ff00]/30 mx-auto mb-4" />
        <p className="text-white/50">No active campaigns right now. Check back soon.</p>
      </div>
    )
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pb-32">
      {/* How onboarding works */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.title} className="relative rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-[#c4ff00]/70">0{i + 1}</span>
              <s.icon className="h-3.5 w-3.5 text-[#c4ff00]" />
              <span className="text-sm font-semibold text-white">{s.title}</span>
            </div>
            <p className="mt-1.5 text-xs text-white/45 leading-snug">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-wrap gap-1.5">
          {industries.map(([name, count]) => (
            <button
              key={name}
              onClick={() => setIndustry(name)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                industry === name
                  ? 'border-[#c4ff00]/60 bg-[#c4ff00]/10 text-[#c4ff00]'
                  : 'border-white/10 text-white/55 hover:border-white/25 hover:text-white/80'
              )}
            >
              {name} <span className="ml-1 text-white/35">{count}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="w-full rounded-lg border border-white/10 bg-[#0a0a0a] pl-9 pr-8 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#c4ff00]/40"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setSort(sort === 'payout' ? 'name' : 'payout')}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/60 hover:text-white hover:border-white/25 flex items-center gap-1.5 whitespace-nowrap"
            title="Change sort"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sort === 'payout' ? 'Top payout' : 'A to Z'}
          </button>
        </div>
      </div>

      {/* Table header (desktop) */}
      <div className="hidden md:grid grid-cols-[28px_minmax(0,2.4fr)_1.1fr_0.8fr_1.3fr_28px] gap-4 px-4 pb-2 text-[11px] font-mono uppercase tracking-wider text-white/35">
        <span />
        <span>Campaign</span>
        <span>Payout</span>
        <span>Buffer</span>
        <span>Hours · Coverage</span>
        <span />
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {list.length === 0 && (
          <div className="rounded-xl border border-white/[0.07] py-12 text-center text-sm text-white/40">No campaigns match your search.</div>
        )}
        {list.map((c, index) => {
          const isSel = selected.has(c.id)
          const isOpen = open === c.id
          const { summary, callTypes } = splitDescription(c.description)
          return (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className={cn(
                'rounded-xl border transition-all',
                isSel ? 'border-[#c4ff00]/50 bg-[#c4ff00]/[0.04] shadow-[0_0_24px_rgba(196,255,0,0.08)]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
              )}
            >
              <div
                onClick={() => toggle(c.id)}
                className="cursor-pointer grid grid-cols-[28px_1fr_auto] md:grid-cols-[28px_minmax(0,2.4fr)_1.1fr_0.8fr_1.3fr_28px] gap-x-4 gap-y-2 items-center px-4 py-4"
              >
                <div className={cn('flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors', isSel ? 'border-[#c4ff00] bg-[#c4ff00]' : 'border-white/25')}>
                  {isSel && <CheckCircle2 className="h-4 w-4 text-[#050505]" />}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-semibold text-white">{c.name}</h3>
                    <span className="rounded-full bg-[#c4ff00]/10 px-2 py-0.5 text-[10px] font-medium text-[#c4ff00]">{c.industry}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45 truncate">{summary || c.call_type}</p>
                </div>

                <div className="text-right md:text-left">
                  <p className="font-display font-semibold text-[#c4ff00]">{c.payout_display ?? `$${c.payout}`}</p>
                  <p className="text-[11px] text-white/35">per call</p>
                </div>

                <div className="hidden md:flex items-center gap-1.5 text-sm text-white/65">
                  <Timer className="h-3.5 w-3.5 text-white/35" />
                  {c.min_duration ? `${c.min_duration}s` : 'Varies'}
                </div>

                <div className="hidden md:block text-xs text-white/55 space-y-1">
                  {c.hours && <p className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-white/35" />{c.hours.replace(', Mon to Sun', '')}</p>}
                  {c.geographic_focus && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-white/35" />{c.geographic_focus}</p>}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : c.id) }}
                  className="col-start-2 md:col-start-auto justify-self-start md:justify-self-end text-white/40 hover:text-white flex items-center gap-1 text-xs"
                  title="Details"
                >
                  <span className="md:hidden">Details</span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
                </button>
              </div>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.06] px-4 py-4 md:pl-[60px] grid gap-4 md:grid-cols-2 text-sm">
                      <div>
                        {callTypes.length > 0 && (
                          <>
                            <p className="text-[11px] font-mono uppercase tracking-wider text-white/35 mb-2">Call types</p>
                            <div className="flex flex-wrap gap-1.5">
                              {callTypes.map((t) => (
                                <span key={t} className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70">{t}</span>
                              ))}
                            </div>
                          </>
                        )}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/55 md:hidden">
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{c.min_duration ? `${c.min_duration}s buffer` : 'Buffer varies'}</span>
                          {c.hours && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{c.hours}</span>}
                          {c.geographic_focus && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.geographic_focus}</span>}
                        </div>
                        <p className="mt-3 text-xs text-white/55">Paid biweekly, Net 15. Call-level reporting on every call.</p>
                      </div>
                      {c.requirements && (
                        <div>
                          <p className="text-[11px] font-mono uppercase tracking-wider text-white/35 mb-2">Requirements</p>
                          <ul className="space-y-1.5">
                            {c.requirements.split(/(?<=\.)\s+/).filter(Boolean).map((r) => (
                              <li key={r} className="flex gap-2 text-xs text-white/65">
                                <span className="text-[#c4ff00]">→</span>{r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Sticky apply bar */}
      <div className={cn(
        'fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300 bg-[#0a0a0a]/95 backdrop-blur border-t border-white/[0.08]',
        selected.size > 0 ? 'translate-y-0' : 'translate-y-full'
      )}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-white/60 truncate">
            <span className="font-semibold text-[#c4ff00]">{selected.size}</span> selected
            <span className="hidden sm:inline text-white/35"> · {safe.filter((c) => selected.has(c.id)).map((c) => c.name).join(', ')}</span>
          </p>
          <button
            onClick={apply}
            className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-[#c4ff00] px-6 py-2.5 text-sm font-semibold text-[#050505] hover:bg-[#d4ff4d] hover:shadow-[0_0_20px_rgba(196,255,0,0.3)] transition-all"
          >
            Apply now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
