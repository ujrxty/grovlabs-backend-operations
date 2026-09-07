'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, Play, Clock, Bell, Mail, MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'

interface SchedulerSettings {
  enabled: boolean
  timezone: string
  vendor_stats_enabled: boolean
  vendor_stats_hour: number
  vendor_stats_minute: number
  non_conversion_qa_enabled: boolean
  non_conversion_qa_hour: number
  non_conversion_qa_minute: number
  sales_qa_enabled: boolean
  sales_qa_hour: number
  sales_qa_minute: number
  discord_enabled: boolean
  discord_webhook_url: string | null
  email_enabled: boolean
  email_recipients: string
  telegram_enabled: boolean
  last_vendor_stats_run: string | null
  last_non_conversion_run: string | null
  last_sales_qa_run: string | null
}

interface TimezoneOption {
  value: string
  label: string
}

const formatTime = (hour: number, minute: number): string => {
  const h = hour % 12 || 12
  const m = minute.toString().padStart(2, '0')
  const ampm = hour < 12 ? 'AM' : 'PM'
  return `${h}:${m} ${ampm}`
}

const formatLastRun = (date: string | null): string => {
  if (!date) return 'Never'
  return new Date(date).toLocaleString()
}

export function SchedulerSettingsContent() {
  const [settings, setSettings] = useState<SchedulerSettings | null>(null)
  const [timezones, setTimezones] = useState<TimezoneOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/scheduler/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setSettings(data.settings)
        }
        if (data.timezones) {
          setTimezones(data.timezones)
        }
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load scheduler settings')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      const res = await fetch('/api/scheduler/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        setSettings(data.settings)
        toast.success('Scheduler settings saved')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  const runManual = async (type: 'vendor-stats' | 'non-conversion-qa' | 'sales-qa') => {
    setRunning(type)
    try {
      const apiKey = 'local-dev-key'
      const res = await fetch(`/api/scheduler/trigger/${type}`, {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success(`${type.replace(/-/g, ' ')} triggered successfully`)
      }
    } catch {
      toast.error(`Failed to trigger ${type}`)
    }
    setRunning(null)
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Scheduler"
        description="Configure automated daily reports and notifications"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        }
      />

      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Scheduler Status
          </CardTitle>
          <CardDescription>
            Enable or disable the automatic scheduler
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Scheduler Enabled</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, reports run automatically at scheduled times
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={v => setSettings(s => s ? { ...s, enabled: v } : s)}
            />
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <select
              value={settings.timezone}
              onChange={e => setSettings(s => s ? { ...s, timezone: e.target.value } : s)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Report Schedules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Report Schedules
          </CardTitle>
          <CardDescription>
            Configure when each report runs daily
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vendor Stats */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.vendor_stats_enabled}
                  onCheckedChange={v => setSettings(s => s ? { ...s, vendor_stats_enabled: v } : s)}
                />
                <Label className="font-medium">Vendor Daily Stats</Label>
              </div>
              <Badge variant={settings.vendor_stats_enabled ? "default" : "secondary"}>
                {formatTime(settings.vendor_stats_hour, settings.vendor_stats_minute)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Hour</Label>
                <select
                  value={settings.vendor_stats_hour}
                  onChange={e => setSettings(s => s ? { ...s, vendor_stats_hour: parseInt(e.target.value) } : s)}
                  disabled={!settings.vendor_stats_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatTime(i, 0).replace(':00 ', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Minute</Label>
                <select
                  value={settings.vendor_stats_minute}
                  onChange={e => setSettings(s => s ? { ...s, vendor_stats_minute: parseInt(e.target.value) } : s)}
                  disabled={!settings.vendor_stats_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {formatLastRun(settings.last_vendor_stats_run)}
            </p>
          </div>

          {/* Non-Conversion QA */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.non_conversion_qa_enabled}
                  onCheckedChange={v => setSettings(s => s ? { ...s, non_conversion_qa_enabled: v } : s)}
                />
                <Label className="font-medium">Non-Conversion QA</Label>
              </div>
              <Badge variant={settings.non_conversion_qa_enabled ? "default" : "secondary"}>
                {formatTime(settings.non_conversion_qa_hour, settings.non_conversion_qa_minute)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Hour</Label>
                <select
                  value={settings.non_conversion_qa_hour}
                  onChange={e => setSettings(s => s ? { ...s, non_conversion_qa_hour: parseInt(e.target.value) } : s)}
                  disabled={!settings.non_conversion_qa_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatTime(i, 0).replace(':00 ', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Minute</Label>
                <select
                  value={settings.non_conversion_qa_minute}
                  onChange={e => setSettings(s => s ? { ...s, non_conversion_qa_minute: parseInt(e.target.value) } : s)}
                  disabled={!settings.non_conversion_qa_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {formatLastRun(settings.last_non_conversion_run)}
            </p>
          </div>

          {/* Sales QA */}
          <div className="p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.sales_qa_enabled}
                  onCheckedChange={v => setSettings(s => s ? { ...s, sales_qa_enabled: v } : s)}
                />
                <Label className="font-medium">Sales QA</Label>
              </div>
              <Badge variant={settings.sales_qa_enabled ? "default" : "secondary"}>
                {formatTime(settings.sales_qa_hour, settings.sales_qa_minute)}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Hour</Label>
                <select
                  value={settings.sales_qa_hour}
                  onChange={e => setSettings(s => s ? { ...s, sales_qa_hour: parseInt(e.target.value) } : s)}
                  disabled={!settings.sales_qa_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{formatTime(i, 0).replace(':00 ', ' ')}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Minute</Label>
                <select
                  value={settings.sales_qa_minute}
                  onChange={e => setSettings(s => s ? { ...s, sales_qa_minute: parseInt(e.target.value) } : s)}
                  disabled={!settings.sales_qa_enabled}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm disabled:opacity-50"
                >
                  {[0, 15, 30, 45].map(m => (
                    <option key={m} value={m}>:{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Last run: {formatLastRun(settings.last_sales_qa_run)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Notification Channels
          </CardTitle>
          <CardDescription>
            Configure which channels receive report notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Discord */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-indigo-500" />
                <Label className="font-medium">Discord</Label>
              </div>
              <Switch
                checked={settings.discord_enabled}
                onCheckedChange={v => setSettings(s => s ? { ...s, discord_enabled: v } : s)}
              />
            </div>
            {settings.discord_enabled && (
              <div className="space-y-2 pl-6">
                <Label className="text-xs">Webhook URL</Label>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={settings.discord_webhook_url || ''}
                  onChange={e => setSettings(s => s ? { ...s, discord_webhook_url: e.target.value || null } : s)}
                />
                <p className="text-xs text-muted-foreground">
                  Uses DISCORD_WEBHOOK_URL env var if not set
                </p>
              </div>
            )}
          </div>

          {/* Email */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-green-500" />
                <Label className="font-medium">Email</Label>
              </div>
              <Switch
                checked={settings.email_enabled}
                onCheckedChange={v => setSettings(s => s ? { ...s, email_enabled: v } : s)}
              />
            </div>
            {settings.email_enabled && (
              <div className="space-y-2 pl-6">
                <Label className="text-xs">Recipients (comma-separated)</Label>
                <Input
                  placeholder="email1@example.com, email2@example.com"
                  value={settings.email_recipients}
                  onChange={e => setSettings(s => s ? { ...s, email_recipients: e.target.value } : s)}
                />
              </div>
            )}
          </div>

          {/* Telegram */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-blue-500" />
                <Label className="font-medium">Telegram</Label>
              </div>
              <Switch
                checked={settings.telegram_enabled}
                onCheckedChange={v => setSettings(s => s ? { ...s, telegram_enabled: v } : s)}
              />
            </div>
            {settings.telegram_enabled && (
              <p className="text-xs text-muted-foreground pl-6">
                Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">How the Scheduler Works</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Scheduler checks every 15 minutes if any report is due</li>
            <li>Each report runs once per day at its scheduled time</li>
            <li>Reports are sent to all enabled notification channels</li>
            <li>Last run times prevent duplicate runs on the same day</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
