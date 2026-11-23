'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  Lock, Loader2, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  AlertCircle, CheckCircle2, Search, ArrowUpDown, Shield, X,
  Save, RefreshCw, Eye, EyeOff, GitMerge, Zap, RotateCcw, Archive
} from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface Campaign {
  id: string
  name: string
  industry: string
  call_type: string
  description: string | null
  payout: number | string
  payout_display: string | null
  payout_type: string
  billing_cycle: string
  min_duration: number | null
  geographic_focus: string | null
  allowed_traffic: string | null
  restricted_traffic: string | null
  requirements: string | null
  compliance_notes: string | null
  hours: string | null
  is_active: boolean
  sort_order: number
  source?: string
  manual_overrides?: string[]
  synced_at?: string | null
  _count?: { applications?: number }
  applications?: any[]
}

const EMPTY_FORM: Omit<Campaign, 'id' | '_count' | 'applications' | 'source' | 'manual_overrides' | 'synced_at'> = {
  name: '',
  industry: '',
  call_type: 'Inbound Calls',
  description: '',
  payout: 0,
  payout_display: '',
  payout_type: 'per_conversion',
  billing_cycle: 'bi-weekly_net15',
  min_duration: 120,
  geographic_focus: 'Nationwide',
  allowed_traffic: '',
  restricted_traffic: 'Robocalls, Cold Transfers, Auto-dialers',
  requirements: '',
  compliance_notes: '',
  hours: '',
  is_active: true,
  sort_order: 0,
}

const PAYOUT_TYPES = [
  { value: 'per_conversion', label: 'Per Conversion' },
  { value: 'per_call', label: 'Per Call' },
  { value: 'per_qualified_call', label: 'Per Qualified Call' },
]

const CALL_TYPES = ['Inbound Calls', 'Live Transfers', 'Warm Transfers']

export function AdminCampaignManager() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [storedPassword, setStoredPassword] = useState('')

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(true)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Toggling state
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [mergeFrom, setMergeFrom] = useState<Campaign | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [merging, setMerging] = useState(false)

  // Check session on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('admin_pw')
    if (saved) {
      setStoredPassword(saved)
      setAuthenticated(true)
    }
  }, [])

  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-admin-password': storedPassword,
    }
  }, [storedPassword])

  // Authenticate
  const handleLogin = async () => {
    if (!password?.trim?.()) {
      setAuthError('Password is required')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/admin/campaigns', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password.trim(),
        },
      })
      if (res.status === 401) {
        setAuthError('Invalid password')
        setAuthLoading(false)
        return
      }
      sessionStorage.setItem('admin_pw', password.trim())
      setStoredPassword(password.trim())
      setAuthenticated(true)
    } catch {
      setAuthError('Connection error')
    } finally {
      setAuthLoading(false)
    }
  }

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    if (!storedPassword) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/campaigns', {
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': storedPassword,
        },
      })
      if (res.status === 401) {
        setAuthenticated(false)
        sessionStorage.removeItem('admin_pw')
        return
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : (data?.campaigns ?? data?.data ?? [])
      setCampaigns(list)
    } catch (err: any) {
      console.error('Fetch campaigns error:', err?.message ?? err)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [storedPassword])

  useEffect(() => {
    if (authenticated && storedPassword) {
      fetchCampaigns()
    }
  }, [authenticated, storedPassword, fetchCampaigns])

  // Toggle active/inactive
  const toggleCampaign = async (campaign: Campaign) => {
    setTogglingId(campaign.id)
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/toggle`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ is_active: !campaign.is_active }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Campaign ${!campaign.is_active ? 'activated' : 'deactivated'}`)
        fetchCampaigns()
      } else {
        toast.error(data?.error ?? data?.message ?? 'Failed to toggle')
      }
    } catch {
      toast.error('Failed to toggle campaign')
    } finally {
      setTogglingId(null)
    }
  }

  // Open edit form
  const openEdit = (campaign: Campaign) => {
    setEditingId(campaign.id)
    setForm({
      name: campaign.name ?? '',
      industry: campaign.industry ?? '',
      call_type: campaign.call_type ?? 'Inbound Calls',
      description: campaign.description ?? '',
      payout: campaign.payout ?? 0,
      payout_display: campaign.payout_display ?? '',
      payout_type: campaign.payout_type ?? 'per_conversion',
      billing_cycle: campaign.billing_cycle ?? 'monthly',
      min_duration: campaign.min_duration ?? 120,
      geographic_focus: campaign.geographic_focus ?? '',
      allowed_traffic: campaign.allowed_traffic ?? '',
      restricted_traffic: campaign.restricted_traffic ?? '',
      requirements: campaign.requirements ?? '',
      compliance_notes: campaign.compliance_notes ?? '',
      hours: campaign.hours ?? '',
      is_active: campaign.is_active ?? true,
      sort_order: campaign.sort_order ?? 0,
    })
    setShowForm(true)
  }

  // Open add form
  const openAdd = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  // Save campaign (create or edit)
  const saveCampaign = async () => {
    if (!form.name?.trim?.()) {
      toast.error('Campaign name is required')
      return
    }
    if (!form.industry?.trim?.()) {
      toast.error('Industry is required')
      return
    }
    setSaving(true)
    try {
      const payload: any = { ...form }
      payload.payout = parseFloat(String(payload.payout)) || 0
      payload.min_duration = payload.min_duration ? parseInt(String(payload.min_duration)) : null
      payload.sort_order = parseInt(String(payload.sort_order)) || 0
      // Clean empty strings to null
      for (const key of ['description', 'payout_display', 'geographic_focus', 'allowed_traffic', 'restricted_traffic', 'requirements', 'compliance_notes', 'hours']) {
        if (!payload[key]?.trim?.()) payload[key] = null
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/admin/campaigns/${editingId}`, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/admin/campaigns', {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (res.ok) {
        toast.success(editingId ? 'Campaign updated' : 'Campaign created')
        setShowForm(false)
        setEditingId(null)
        fetchCampaigns()
      } else {
        toast.error(data?.error ?? data?.message ?? 'Failed to save')
      }
    } catch {
      toast.error('Failed to save campaign')
    } finally {
      setSaving(false)
    }
  }

  // Delete campaign
  const deleteCampaign = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/campaigns/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data?.message ?? 'Campaign deleted')
        fetchCampaigns()
      } else {
        toast.error(data?.error ?? data?.message ?? 'Cannot delete campaign')
      }
    } catch {
      toast.error('Failed to delete campaign')
    } finally {
      setDeletingId(null)
    }
  }

  // Pull every active TrackDrive offer into the portal now (also runs every 15 min on its own)
  const syncNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/campaigns/sync', { method: 'POST', headers: getHeaders() })
      const data = await res.json()
      if (res.ok) {
        const parts = [`${data?.live?.length ?? 0} live`]
        if (data?.created?.length) parts.push(`${data.created.length} added`)
        if (data?.merged?.length) parts.push(`${data.merged.length} merged`)
        if (data?.hidden?.length) parts.push(`${data.hidden.length} hidden`)
        toast.success(`Synced from TrackDrive: ${parts.join(', ')}`)
        if (data?.unmatched?.length) toast.message(`Offers not matched to a vertical: ${data.unmatched.join(', ')}`)
        fetchCampaigns()
      } else toast.error(data?.error ?? data?.message ?? 'Sync failed')
    } catch {
      toast.error('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const doMerge = async () => {
    if (!mergeFrom || !mergeInto) return
    setMerging(true)
    try {
      const res = await fetch(`/api/admin/campaigns/${mergeFrom.id}/merge`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ into_id: mergeInto }) })
      const data = await res.json()
      if (res.ok) {
        toast.success(`${data?.message ?? 'Merged'} (${data?.applications_moved ?? 0} applications, ${data?.ios_moved ?? 0} IOs moved)`)
        setMergeFrom(null); setMergeInto('')
        fetchCampaigns()
      } else toast.error(data?.error ?? data?.message ?? 'Merge failed')
    } catch {
      toast.error('Merge failed')
    } finally {
      setMerging(false)
    }
  }

  const resetOverrides = async (c: Campaign) => {
    const res = await fetch(`/api/admin/campaigns/${c.id}`, { method: 'PATCH', headers: getHeaders(), body: JSON.stringify({ reset_overrides: true }) })
    if (res.ok) { toast.success('Back on TrackDrive values'); syncNow() }
    else toast.error('Failed to reset')
  }

  const getAppCount = (c: Campaign) => {
    return c?._count?.applications ?? c?.applications?.length ?? 0
  }

  const formatPayoutType = (type: string) => {
    return PAYOUT_TYPES.find(p => p.value === type)?.label ?? type ?? ''
  }

  // Filter campaigns
  const filtered = (campaigns ?? []).filter((c: Campaign) => {
    if (!showInactive && !c.is_active) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      return (c.name ?? '').toLowerCase().includes(q) || (c.industry ?? '').toLowerCase().includes(q)
    }
    return true
  }).sort((a: Campaign, b: Campaign) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  // --- Password Gate ---
  if (!authenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <div className="rounded-2xl bg-white border border-gray-200 shadow-lg p-8">
            <div className="flex items-center justify-center mb-6">
              <div className="h-14 w-14 rounded-full bg-[#b87333]/10 flex items-center justify-center">
                <Shield className="h-7 w-7 text-[#b87333]" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-center text-gray-900 mb-1">Admin Access</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Enter the admin password to manage campaigns.</p>
            {authError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2 mb-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {authError}
              </div>
            )}
            <input
              type="password"
              value={password}
              onChange={(e: any) => { setPassword(e?.target?.value ?? ''); setAuthError('') }}
              onKeyDown={(e: any) => { if (e?.key === 'Enter') handleLogin() }}
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 mb-4"
              placeholder="Password"
              autoFocus
            />
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full rounded-lg bg-[#b87333] px-4 py-3 text-sm font-semibold text-white hover:bg-[#9a5f28] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              {authLoading ? 'Verifying...' : 'Unlock'}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // --- Campaign Manager ---
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#b87333]" />
            Campaign Manager
          </h1>
          <p className="text-sm text-gray-500 mt-1">{campaigns.length} campaigns total</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCampaigns}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={syncNow}
            disabled={syncing}
            className="rounded-lg border border-[#b87333]/30 bg-[#b87333]/5 px-3 py-2 text-sm font-medium text-[#b87333] hover:bg-[#b87333]/10 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Pull every active TrackDrive offer into the portal (runs automatically every 15 minutes)"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Sync from TrackDrive
          </button>
          <button
            onClick={openAdd}
            className="rounded-lg bg-[#b87333] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a5f28] transition-colors flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Campaign
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e: any) => setSearch(e?.target?.value ?? '')}
            className="w-full rounded-lg border border-gray-200 pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
            placeholder="Search campaigns..."
          />
        </div>
        <button
          onClick={() => setShowInactive(!showInactive)}
          className={cn(
            'rounded-lg border px-3 py-2 text-sm transition-colors flex items-center gap-1.5',
            showInactive ? 'border-[#b87333]/20 bg-[#b87333]/5 text-[#b87333]' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          )}
        >
          {showInactive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showInactive ? 'Showing all' : 'Active only'}
        </button>
      </div>

      {/* Campaign Table */}
      {loading && campaigns.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#b87333]" />
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Campaign</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Industry</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Payout</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Apps</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-400">
                      {search ? 'No campaigns match your search' : 'No campaigns found'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((c: Campaign) => {
                    const appCount = getAppCount(c)
                    const payoutLabel = c.payout_display ?? `$${c.payout ?? 0}`
                    const pinned = c.manual_overrides ?? []
                    return (
                      <tr key={c.id} className={cn('border-b border-gray-100 hover:bg-gray-50/50 transition-colors', !c.is_active && 'opacity-60')}>
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{c.sort_order ?? 0}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 flex items-center gap-1.5 flex-wrap">
                            {c.name ?? ''}
                            {c.source === 'trackdrive' && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide rounded-full bg-blue-50 text-blue-700 px-1.5 py-0.5">TrackDrive</span>
                            )}
                          </p>
                          {c.geographic_focus && <p className="text-xs text-gray-400">{c.geographic_focus}{c.hours ? ` · ${c.hours}` : ''}</p>}
                          {c.source === 'trackdrive' && pinned.length > 0 && (
                            <p className="text-[11px] text-amber-700 mt-0.5 flex items-center gap-1">
                              Edited by hand: {pinned.join(', ')}
                              <button onClick={() => resetOverrides(c)} className="underline hover:text-amber-900 inline-flex items-center gap-0.5" title="Go back to the values from TrackDrive">
                                <RotateCcw className="h-3 w-3" /> reset
                              </button>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{c.industry ?? ''}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{c.call_type ?? ''}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-green-700">{payoutLabel}</span>
                          <span className="text-xs text-gray-400 ml-1">{formatPayoutType(c.payout_type ?? '')}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleCampaign(c)}
                            disabled={togglingId === c.id}
                            className="flex items-center gap-1.5 group"
                            title={c.is_active ? 'Click to deactivate' : 'Click to activate'}
                          >
                            {togglingId === c.id ? (
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            ) : c.is_active ? (
                              <ToggleRight className="h-6 w-6 text-green-600 group-hover:text-green-700" />
                            ) : (
                              <ToggleLeft className="h-6 w-6 text-gray-300 group-hover:text-gray-400" />
                            )}
                            <span className={cn(
                              'text-xs font-medium rounded-full px-2 py-0.5',
                              c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                            )}>
                              {c.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{appCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(c)}
                              className="rounded-md p-1.5 text-gray-400 hover:text-[#b87333] hover:bg-[#b87333]/5 transition-colors"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setMergeFrom(c); setMergeInto('') }}
                              className="rounded-md p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Merge into another campaign (moves applications and IOs)"
                            >
                              <GitMerge className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                const msg = appCount > 0
                                  ? `"${c.name}" has ${appCount} application(s), so it will be archived (hidden everywhere, history kept). Tip: use Merge to move those applications to another campaign first. Continue?`
                                  : `Delete "${c.name}"? This cannot be undone.`
                                if (confirm(msg)) deleteCampaign(c.id)
                              }}
                              disabled={deletingId === c.id}
                              className="rounded-md p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={appCount > 0 ? 'Archive (has applications)' : 'Delete'}
                            >
                              {deletingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : appCount > 0 ? <Archive className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-8 pb-8 overflow-y-auto"
            onClick={(e: any) => { if (e?.target === e?.currentTarget) setShowForm(false) }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-200 mx-4 my-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Edit Campaign' : 'Add New Campaign'}
                </h2>
                <button onClick={() => setShowForm(false)} className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Name & Industry */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Campaign Name *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e: any) => setForm({ ...form, name: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="e.g. Auto Insurance RTB"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Industry *</label>
                    <input
                      type="text"
                      value={form.industry}
                      onChange={(e: any) => setForm({ ...form, industry: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="e.g. Insurance, Home Services"
                    />
                  </div>
                </div>

                {/* Call Type & Payout Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Call Type</label>
                    <select
                      value={form.call_type}
                      onChange={(e: any) => setForm({ ...form, call_type: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 bg-white"
                    >
                      {CALL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payout Type</label>
                    <select
                      value={form.payout_type}
                      onChange={(e: any) => setForm({ ...form, payout_type: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 bg-white"
                    >
                      {PAYOUT_TYPES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Payout & Payout Display */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payout ($)</label>
                    <input
                      type="number"
                      value={form.payout}
                      onChange={(e: any) => setForm({ ...form, payout: e?.target?.value ?? 0 })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="25.00"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Display Override</label>
                    <input
                      type="text"
                      value={form.payout_display ?? ''}
                      onChange={(e: any) => setForm({ ...form, payout_display: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="e.g. $20-$90 or leave blank"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Min Duration (sec)</label>
                    <input
                      type="number"
                      value={form.min_duration ?? ''}
                      onChange={(e: any) => setForm({ ...form, min_duration: e?.target?.value ? parseInt(e.target.value) : null })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="120"
                    />
                  </div>
                </div>

                {/* Billing & Sort & Active */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Billing Cycle</label>
                    <select
                      value={form.billing_cycle}
                      onChange={(e: any) => setForm({ ...form, billing_cycle: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 bg-white"
                    >
                      <option value="bi-weekly_net15">Bi-Weekly Net 15</option>
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly_net14">Monthly Net-14</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sort Order</label>
                    <input
                      type="number"
                      value={form.sort_order}
                      onChange={(e: any) => setForm({ ...form, sort_order: parseInt(e?.target?.value ?? '0') || 0 })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                    />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e: any) => setForm({ ...form, is_active: e?.target?.checked ?? false })}
                        className="h-4 w-4 rounded border-gray-300 text-[#b87333] focus:ring-[#b87333]/50"
                      />
                      <span className="text-sm text-gray-700">Active</span>
                    </label>
                  </div>
                </div>

                {/* Geographic Focus + Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Geographic Focus</label>
                    <input
                      type="text"
                      value={form.geographic_focus ?? ''}
                      onChange={(e: any) => setForm({ ...form, geographic_focus: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="Nationwide"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hours</label>
                    <input
                      type="text"
                      value={form.hours ?? ''}
                      onChange={(e: any) => setForm({ ...form, hours: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50"
                      placeholder="9:00 AM to 9:00 PM EST, Mon to Sun"
                    />
                  </div>
                </div>
                {editingId && campaigns.find((x) => x.id === editingId)?.source === 'trackdrive' && (
                  <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                    Synced from TrackDrive. Any field you change here is pinned and the sync won&apos;t overwrite it.
                  </p>
                )}

                {/* Description */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={form.description ?? ''}
                    onChange={(e: any) => setForm({ ...form, description: e?.target?.value ?? '' })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 resize-none"
                    rows={2}
                    placeholder="Brief campaign description..."
                  />
                </div>

                {/* Traffic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Allowed Traffic</label>
                    <textarea
                      value={form.allowed_traffic ?? ''}
                      onChange={(e: any) => setForm({ ...form, allowed_traffic: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 resize-none"
                      rows={2}
                      placeholder="SEO, PPC, Social Media..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Restricted Traffic</label>
                    <textarea
                      value={form.restricted_traffic ?? ''}
                      onChange={(e: any) => setForm({ ...form, restricted_traffic: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 resize-none"
                      rows={2}
                      placeholder="Robocalls, Cold Transfers..."
                    />
                  </div>
                </div>

                {/* Requirements & Compliance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Requirements</label>
                    <textarea
                      value={form.requirements ?? ''}
                      onChange={(e: any) => setForm({ ...form, requirements: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 resize-none"
                      rows={2}
                      placeholder="Qualification requirements..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Compliance Notes</label>
                    <textarea
                      value={form.compliance_notes ?? ''}
                      onChange={(e: any) => setForm({ ...form, compliance_notes: e?.target?.value ?? '' })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#b87333]/50 resize-none"
                      rows={2}
                      placeholder="TCPA, FCC, state-specific..."
                    />
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveCampaign}
                  disabled={saving}
                  className="rounded-lg bg-[#b87333] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9a5f28] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Campaign')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Merge Modal */}
      {mergeFrom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={(e: any) => { if (e?.target === e?.currentTarget) setMergeFrom(null) }}>
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><GitMerge className="h-5 w-5 text-blue-600" /> Merge campaign</h2>
            <p className="text-sm text-gray-500 mt-1">
              Move all applications and IOs from <b>{mergeFrom.name}</b> into the campaign below. <b>{mergeFrom.name}</b> is then archived.
            </p>
            <select
              value={mergeInto}
              onChange={(e: any) => setMergeInto(e?.target?.value ?? '')}
              className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Keep this one…</option>
              {campaigns.filter((x) => x.id !== mergeFrom.id).map((x) => (
                <option key={x.id} value={x.id}>{x.name}{x.is_active ? '' : ' (inactive)'}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setMergeFrom(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
              <button onClick={doMerge} disabled={!mergeInto || merging} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
