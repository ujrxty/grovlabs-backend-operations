'use client'

import { useEffect, useState, useCallback } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Bell, BellOff, Save, RefreshCw, Clock, TrendingDown, PhoneOff, DollarSign,
  Gauge, Send, AlertTriangle, Zap, PhoneMissed, XCircle, Timer, Loader2,
} from 'lucide-react'

interface LossSettings {
  alerts_enabled: boolean
  recipients: string
  active_from_hour: number
  active_to_hour: number
  low_conv_enabled: boolean
  low_conv_pct: number
  low_conv_min_calls: number
  no_answer_enabled: boolean
  no_answer_threshold: number
  low_rpc_enabled: boolean
  low_rpc_threshold: number
  low_rpc_min_calls: number
  near_cap_enabled: boolean
  near_cap_pct: number
  no_connect_enabled: boolean
  no_connect_min_calls: number
  zero_conv_enabled: boolean
  zero_conv_min_calls: number
  short_dur_enabled: boolean
  short_dur_seconds: number
  short_dur_min_calls: number
  last_check_at?: string | null
  last_alert_at?: string | null
}

interface LossAlert {
  type: string
  severity: 'warning' | 'critical'
  vendor?: string
  campaign?: string
  buyer?: string
  message: string
  calls: number
  revenue?: number
}

const ALERT_LABELS: Record<string, string> = {
  low_conversion: 'Low Conversion',
  no_answers: 'No Answers',
  low_rpc: 'Low RPC',
  no_connect_buyer: 'No-Connect by Buyer',
  zero_conversion: 'Zero Conversions',
  short_duration: 'Short Duration',
}

function fmtDate(iso?: string | null) {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/New_York', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  } catch {
    return null
  }
}

// Small settings card wrapper with a header, toggle and body.
function AlertToggleCard({
  icon, iconClass, title, enabled, onToggle, children,
}: {
  icon: React.ReactNode
  iconClass?: string
  title: string
  enabled: boolean
  onToggle: (v: boolean) => void
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 shadow-sm transition-opacity',
      !enabled && 'opacity-60'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('flex h-6 w-6 items-center justify-center', iconClass)}>{icon}</span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {children}
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground mb-1.5 mt-3">{children}</p>
}

export function LossMonitorContent() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<LossSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [alerts, setAlerts] = useState<LossAlert[]>([])
  const [previewLoading, setPreviewLoading] = useState(false)

  const todayLabel = new Date().toLocaleDateString('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  })

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/loss-monitor/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setSettings(data)
    } catch {
      toast({ title: 'Could not load settings', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/loss-monitor/preview?range=today', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setAlerts(Array.isArray(data.alerts) ? data.alerts : [])
      }
    } catch {
      // silent
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  useEffect(() => { loadSettings(); loadPreview() }, [loadSettings, loadPreview])

  const update = (patch: Partial<LossSettings>) =>
    setSettings((s) => (s ? { ...s, ...patch } : s))

  const num = (v: string, fallback: number) => {
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }

  const save = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/loss-monitor/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error('save failed')
      const data = await res.json()
      if (data?.settings) setSettings(data.settings)
      toast({ title: 'Settings saved', description: 'Your Loss Monitor alert rules are live.' })
      loadPreview()
    } catch {
      toast({ title: 'Could not save settings', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Loss Monitor" description="Watching today's campaigns for losses & no-answers" />
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading settings…
        </div>
      </div>
    )
  }

  const lastCheck = fmtDate(settings.last_check_at)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loss Monitor"
        description={`Watching today's campaigns for losses & no-answers · ${todayLabel} (EST)`}
        actions={
          <>
            {settings.alerts_enabled ? (
              <Badge className="gap-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200">
                <Bell className="h-3.5 w-3.5" /> Alerts On
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1.5">
                <BellOff className="h-3.5 w-3.5" /> Alerts Off
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => { loadSettings(); loadPreview() }} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </>
        }
      />

      {lastCheck && (
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Last alert check: <span className="font-medium text-foreground">{lastCheck} EST</span>
        </div>
      )}

      <Card className="shadow-sm">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Alert Settings</h2>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="master" className="text-sm text-muted-foreground">Master alerts</Label>
              <Switch id="master" checked={settings.alerts_enabled}
                onCheckedChange={(v) => update({ alerts_enabled: v })} />
            </div>
          </div>

          {/* Primary alerts grid */}
          <div className="grid gap-4 md:grid-cols-2">
            <AlertToggleCard
              icon={<TrendingDown className="h-4 w-4" />} iconClass="text-rose-500"
              title="Low Conversion" enabled={settings.low_conv_enabled}
              onToggle={(v) => update({ low_conv_enabled: v })}
            >
              <FieldLabel>Flag campaigns below this conversion %</FieldLabel>
              <div className="relative">
                <Input type="number" value={settings.low_conv_pct}
                  onChange={(e) => update({ low_conv_pct: num(e.target.value, settings.low_conv_pct) })} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
              <FieldLabel>Minimum connected calls before flagging</FieldLabel>
              <Input type="number" value={settings.low_conv_min_calls}
                onChange={(e) => update({ low_conv_min_calls: num(e.target.value, settings.low_conv_min_calls) })} />
            </AlertToggleCard>

            <AlertToggleCard
              icon={<PhoneOff className="h-4 w-4" />} iconClass="text-rose-500"
              title="No Answers" enabled={settings.no_answer_enabled}
              onToggle={(v) => update({ no_answer_enabled: v })}
            >
              <FieldLabel>Alert when no-answer calls reach</FieldLabel>
              <Input type="number" value={settings.no_answer_threshold}
                onChange={(e) => update({ no_answer_threshold: num(e.target.value, settings.no_answer_threshold) })} />
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                A no-answer is any call that was sent but never connected — often a buyer tech issue that needs a human to step in.
              </p>
            </AlertToggleCard>

            <AlertToggleCard
              icon={<DollarSign className="h-4 w-4" />} iconClass="text-amber-500"
              title="Low RPC" enabled={settings.low_rpc_enabled}
              onToggle={(v) => update({ low_rpc_enabled: v })}
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sends a <strong>separate email alert</strong> when a vendor's Revenue Per Call (RPC) on a campaign drops to or below the threshold, after that vendor/campaign reaches the minimum calls. RPC is always calculated per campaign, never combined.
              </p>
              <FieldLabel>RPC at or below ($)</FieldLabel>
              <Input type="number" value={settings.low_rpc_threshold}
                onChange={(e) => update({ low_rpc_threshold: num(e.target.value, settings.low_rpc_threshold) })} />
              <FieldLabel>Minimum calls before flagging</FieldLabel>
              <Input type="number" value={settings.low_rpc_min_calls}
                onChange={(e) => update({ low_rpc_min_calls: num(e.target.value, settings.low_rpc_min_calls) })} />
            </AlertToggleCard>

            <AlertToggleCard
              icon={<Gauge className="h-4 w-4" />} iconClass="text-amber-500"
              title="Near Cap" enabled={settings.near_cap_enabled}
              onToggle={(v) => update({ near_cap_enabled: v })}
            >
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sends an email when a campaign's conversions reach a set % of its daily or global cap.
              </p>
              <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
                Parked — the call platform doesn't expose a per-campaign cap yet, so this can't be auto-evaluated. Leave off until a cap source is wired in.
              </div>
              <FieldLabel>Threshold %</FieldLabel>
              <Input type="number" value={settings.near_cap_pct}
                onChange={(e) => update({ near_cap_pct: num(e.target.value, settings.near_cap_pct) })} />
            </AlertToggleCard>

            <AlertToggleCard
              icon={<Send className="h-4 w-4" />} iconClass="text-primary"
              title="Email Recipients" enabled={settings.alerts_enabled}
              onToggle={(v) => update({ alerts_enabled: v })}
            >
              <FieldLabel>Who gets the alert emails</FieldLabel>
              <Input value={settings.recipients}
                onChange={(e) => update({ recipients: e.target.value })}
                placeholder="uj@grovlabs.com" />
              <p className="text-xs text-muted-foreground mt-3">
                Comma-separated. One grouped email is sent per check when campaigns are flagged.
              </p>
            </AlertToggleCard>

            <AlertToggleCard
              icon={<Clock className="h-4 w-4" />} iconClass="text-amber-500"
              title="Active Hours (EST)" enabled={settings.alerts_enabled}
              onToggle={(v) => update({ alerts_enabled: v })}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>From (hour)</FieldLabel>
                  <Input type="number" min={0} max={24} value={settings.active_from_hour}
                    onChange={(e) => update({ active_from_hour: num(e.target.value, settings.active_from_hour) })} />
                </div>
                <div>
                  <FieldLabel>To (hour)</FieldLabel>
                  <Input type="number" min={0} max={24} value={settings.active_to_hour}
                    onChange={(e) => update({ active_to_hour: num(e.target.value, settings.active_to_hour) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Set both to 0 &amp; 24 to monitor around the clock. Checks run every hour.
              </p>
            </AlertToggleCard>
          </div>

          {/* Traffic quality alerts */}
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Traffic Quality Alerts</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <AlertToggleCard
                icon={<PhoneMissed className="h-4 w-4" />} iconClass="text-rose-500"
                title="No-Connect by Buyer" enabled={settings.no_connect_enabled}
                onToggle={(v) => update({ no_connect_enabled: v })}
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Flags buyer targets that receive calls but <strong>zero connect</strong>. Usually means a tech issue on the buyer's end.
                </p>
                <FieldLabel>Min calls before flagging</FieldLabel>
                <Input type="number" value={settings.no_connect_min_calls}
                  onChange={(e) => update({ no_connect_min_calls: num(e.target.value, settings.no_connect_min_calls) })} />
              </AlertToggleCard>

              <AlertToggleCard
                icon={<XCircle className="h-4 w-4" />} iconClass="text-amber-500"
                title="Zero Conv (Vendor×Buyer)" enabled={settings.zero_conv_enabled}
                onToggle={(v) => update({ zero_conv_enabled: v })}
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Flags vendor/buyer combos with meaningful call volume but <strong>zero conversions</strong>. May indicate bad traffic or a routing mismatch.
                </p>
                <FieldLabel>Min calls before flagging</FieldLabel>
                <Input type="number" value={settings.zero_conv_min_calls}
                  onChange={(e) => update({ zero_conv_min_calls: num(e.target.value, settings.zero_conv_min_calls) })} />
              </AlertToggleCard>

              <AlertToggleCard
                icon={<Timer className="h-4 w-4" />} iconClass="text-violet-500"
                title="Short Duration" enabled={settings.short_dur_enabled}
                onToggle={(v) => update({ short_dur_enabled: v })}
              >
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Flags campaigns where the average call duration is under the threshold. Short calls often = spam or bad leads.
                </p>
                <FieldLabel>Duration threshold (seconds)</FieldLabel>
                <Input type="number" value={settings.short_dur_seconds}
                  onChange={(e) => update({ short_dur_seconds: num(e.target.value, settings.short_dur_seconds) })} />
                <FieldLabel>Min calls before flagging</FieldLabel>
                <Input type="number" value={settings.short_dur_min_calls}
                  onChange={(e) => update({ short_dur_min_calls: num(e.target.value, settings.short_dur_min_calls) })} />
              </AlertToggleCard>
            </div>
          </div>

          <Separator />
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live preview of today's alerts */}
      <Card className="shadow-sm">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Today's Flags</h2>
              <span className="text-sm text-muted-foreground">
                (live preview using current thresholds)
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={loadPreview} disabled={previewLoading} className="gap-1.5">
              {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Re-check
            </Button>
          </div>

          {previewLoading ? (
            <div className="py-10 text-center text-muted-foreground text-sm">Checking today's campaigns…</div>
          ) : alerts.length === 0 ? (
            <div className="py-10 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
                <Bell className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">No losses flagged right now</p>
              <p className="text-xs text-muted-foreground mt-1">Everything is within your thresholds for today.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                  <span className={cn(
                    'mt-0.5 flex h-2 w-2 shrink-0 rounded-full',
                    a.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn(
                        'text-[11px]',
                        a.severity === 'critical' ? 'border-rose-200 text-rose-600' : 'border-amber-200 text-amber-600'
                      )}>
                        {ALERT_LABELS[a.type] || a.type}
                      </Badge>
                      {a.vendor && <span className="text-sm font-medium">{a.vendor}</span>}
                      {a.buyer && (
                        <span className="text-xs text-muted-foreground">
                          {a.vendor ? '· ' : ''}{a.buyer}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
