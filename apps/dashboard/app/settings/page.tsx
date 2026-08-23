'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, Clock, Building2, Save, Check, Mail, Phone, User, MapPin, Palette, Server, Send, Eye, EyeOff, Brain, Radio, Key, MessageSquare, Link2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/UTC-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/UTC-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/UTC-6' },
  { value: 'America/Phoenix', label: 'Arizona (MST)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/UTC-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/UTC-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
]

const COLOR_PRESETS = [
  { value: '#8b5a2b', label: 'Copper Wood', preview: 'bg-[#8b5a2b]' },
  { value: '#1e40af', label: 'Royal Blue', preview: 'bg-[#1e40af]' },
  { value: '#065f46', label: 'Forest Green', preview: 'bg-[#065f46]' },
  { value: '#7c3aed', label: 'Purple', preview: 'bg-[#7c3aed]' },
  { value: '#dc2626', label: 'Red', preview: 'bg-[#dc2626]' },
  { value: '#0891b2', label: 'Teal', preview: 'bg-[#0891b2]' },
]

const SMTP_PROVIDERS = [
  { value: 'gmail', label: 'Gmail SMTP', host: 'smtp.gmail.com', port: '587' },
  { value: 'outlook', label: 'Outlook/Office 365', host: 'smtp.office365.com', port: '587' },
  { value: 'sendgrid', label: 'SendGrid', host: 'smtp.sendgrid.net', port: '587' },
  { value: 'mailgun', label: 'Mailgun', host: 'smtp.mailgun.org', port: '587' },
  { value: 'custom', label: 'Custom SMTP', host: '', port: '587' },
]

interface Settings {
  timezone: string
  companyName: string
  companyAddress: string
  signatoryName: string
  signatoryTitle: string
  contactEmail: string
  contactPhone: string
  brandColor: string
  // SMTP Settings
  smtpEnabled: boolean
  smtpProvider: string
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFromEmail: string
  smtpFromName: string
  smtpSecure: boolean
  // AI Settings
  openaiApiKey: string
  // TrackDrive Settings
  trackdriveSubdomain: string
  trackdrivePublicKey: string
  trackdrivePrivateKey: string
  // Discord Settings
  discordWebhookUrl: string
  // Service URLs
  vendorPortalUrl: string
  dashboardUrl: string
  qaAgentUrl: string
}

const DEFAULT_SETTINGS: Settings = {
  timezone: 'America/New_York',
  companyName: 'GrovLabs Inc',
  companyAddress: '8301 State Line Rd Ste 220, Kansas City, MO 64114',
  signatoryName: 'UJ',
  signatoryTitle: 'Chief Executive Officer',
  contactEmail: 'uj@grovlabs.com',
  contactPhone: '+1 (754) 344-0773',
  brandColor: '#8b5a2b',
  // SMTP defaults
  smtpEnabled: false,
  smtpProvider: 'gmail',
  smtpHost: 'smtp.gmail.com',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFromEmail: '',
  smtpFromName: 'GrovLabs Inc',
  smtpSecure: true,
  // AI Settings
  openaiApiKey: '',
  // TrackDrive Settings
  trackdriveSubdomain: 'grovlabs',
  trackdrivePublicKey: '',
  trackdrivePrivateKey: '',
  // Discord Settings
  discordWebhookUrl: '',
  // Service URLs
  vendorPortalUrl: '',
  dashboardUrl: '',
  qaAgentUrl: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof Settings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleProviderChange = (provider: string) => {
    const preset = SMTP_PROVIDERS.find(p => p.value === provider)
    if (preset) {
      setSettings(prev => ({
        ...prev,
        smtpProvider: provider,
        smtpHost: preset.host || prev.smtpHost,
        smtpPort: preset.port || prev.smtpPort,
      }))
    }
  }

  const testEmailConnection = async () => {
    setTestingEmail(true)
    setTestEmailResult(null)
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      setTestEmailResult({
        success: data.success,
        message: data.message || (data.success ? 'Test email sent successfully!' : 'Failed to send test email'),
      })
    } catch (error: any) {
      setTestEmailResult({ success: false, message: error.message || 'Connection failed' })
    } finally {
      setTestingEmail(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Configure your company info, email branding, and preferences</p>
        </div>

        <div className="grid gap-6 max-w-3xl">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Information
              </CardTitle>
              <CardDescription>
                Used in emails, invoices, IO/MSA documents, and all communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder="Your Company Inc"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Input
                    id="companyAddress"
                    value={settings.companyAddress}
                    onChange={(e) => updateField('companyAddress', e.target.value)}
                    placeholder="123 Main St, City, ST 12345"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signatoryName">Authorized Signatory</Label>
                  <Input
                    id="signatoryName"
                    value={settings.signatoryName}
                    onChange={(e) => updateField('signatoryName', e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signatoryTitle">Title</Label>
                  <Input
                    id="signatoryTitle"
                    value={settings.signatoryTitle}
                    onChange={(e) => updateField('signatoryTitle', e.target.value)}
                    placeholder="Chief Executive Officer"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> Contact Email
                  </Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => updateField('contactEmail', e.target.value)}
                    placeholder="contact@company.com"
                  />
                  <p className="text-xs text-muted-foreground">Used as reply-to for all system emails</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> Phone / WhatsApp
                  </Label>
                  <Input
                    id="contactPhone"
                    value={settings.contactPhone}
                    onChange={(e) => updateField('contactPhone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Email Branding
              </CardTitle>
              <CardDescription>
                Customize the look of outgoing emails (invoices, statements, alerts)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Brand Color</Label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => updateField('brandColor', color.value)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                        settings.brandColor === color.value
                          ? 'border-primary bg-primary/5'
                          : 'border-transparent bg-muted/50 hover:bg-muted'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full ${color.preview}`} />
                      <span className="text-sm">{color.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Label htmlFor="customColor" className="text-xs text-muted-foreground">Custom:</Label>
                  <Input
                    id="customColor"
                    type="color"
                    value={settings.brandColor}
                    onChange={(e) => updateField('brandColor', e.target.value)}
                    className="w-12 h-8 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.brandColor}
                    onChange={(e) => updateField('brandColor', e.target.value)}
                    className="w-28 font-mono text-sm"
                    placeholder="#8b5a2b"
                  />
                </div>
              </div>

              {/* Email Preview */}
              <div className="mt-4 p-4 border rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground mb-2">Email Header Preview:</p>
                <div
                  className="rounded-t-lg p-4 text-center"
                  style={{ background: `linear-gradient(135deg, ${settings.brandColor}, ${adjustColor(settings.brandColor, -20)})` }}
                >
                  <p className="text-white font-bold text-lg">{settings.companyName}</p>
                  <p className="text-white/80 text-sm">Invoice</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SMTP Email Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                Email Server (SMTP)
              </CardTitle>
              <CardDescription>
                Configure your own SMTP server to send emails (invoices, statements, alerts)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm font-medium">Enable SMTP</span>
                </div>
                <button
                  onClick={() => updateField('smtpEnabled', !settings.smtpEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.smtpEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.smtpEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {settings.smtpEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Email Provider</Label>
                    <Select value={settings.smtpProvider} onValueChange={handleProviderChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SMTP_PROVIDERS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpHost">SMTP Host</Label>
                      <Input
                        id="smtpHost"
                        value={settings.smtpHost}
                        onChange={(e) => updateField('smtpHost', e.target.value)}
                        placeholder="smtp.gmail.com"
                        disabled={settings.smtpProvider !== 'custom'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPort">Port</Label>
                      <Input
                        id="smtpPort"
                        value={settings.smtpPort}
                        onChange={(e) => updateField('smtpPort', e.target.value)}
                        placeholder="587"
                        disabled={settings.smtpProvider !== 'custom'}
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpUser">Username / Email</Label>
                      <Input
                        id="smtpUser"
                        value={settings.smtpUser}
                        onChange={(e) => updateField('smtpUser', e.target.value)}
                        placeholder="your-email@gmail.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpPass">Password / App Password</Label>
                      <div className="relative">
                        <Input
                          id="smtpPass"
                          type={showPassword ? 'text' : 'password'}
                          value={settings.smtpPass}
                          onChange={(e) => updateField('smtpPass', e.target.value)}
                          placeholder="••••••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {settings.smtpProvider === 'gmail' && (
                        <p className="text-xs text-muted-foreground">
                          Use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" className="text-primary underline">App Password</a>, not your regular password
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromEmail">From Email</Label>
                      <Input
                        id="smtpFromEmail"
                        type="email"
                        value={settings.smtpFromEmail}
                        onChange={(e) => updateField('smtpFromEmail', e.target.value)}
                        placeholder="noreply@yourcompany.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtpFromName">From Name</Label>
                      <Input
                        id="smtpFromName"
                        value={settings.smtpFromName}
                        onChange={(e) => updateField('smtpFromName', e.target.value)}
                        placeholder="Your Company"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      onClick={testEmailConnection}
                      disabled={testingEmail || !settings.smtpUser || !settings.smtpPass}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {testingEmail ? 'Sending...' : 'Send Test Email'}
                    </Button>
                    {testEmailResult && (
                      <p className={`text-sm mt-2 ${testEmailResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {testEmailResult.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {!settings.smtpEnabled && (
                <p className="text-sm text-muted-foreground">
                  When disabled, emails are sent via the default notification system.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timezone Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Timezone
              </CardTitle>
              <CardDescription>
                Set the timezone for date filters, reports, and billing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Business Timezone</Label>
                <Select value={settings.timezone} onValueChange={(v) => updateField('timezone', v)}>
                  <SelectTrigger id="timezone" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{tz.label}</span>
                          <span className="text-xs text-muted-foreground">{tz.offset}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  Current time: {new Intl.DateTimeFormat('en-US', {
                    timeZone: settings.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }).format(new Date())}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* AI Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                AI Settings
              </CardTitle>
              <CardDescription>
                Configure AI services for call analysis and QA automation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="openaiApiKey">OpenAI API Key</Label>
                <div className="relative">
                  <Input
                    id="openaiApiKey"
                    type={showPassword ? 'text' : 'password'}
                    value={settings.openaiApiKey}
                    onChange={(e) => updateField('openaiApiKey', e.target.value)}
                    placeholder="sk-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used for call transcript analysis and QA automation. Get your key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    OpenAI Dashboard
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* TrackDrive Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary" />
                TrackDrive Integration
              </CardTitle>
              <CardDescription>
                Configure TrackDrive API connection for call tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trackdriveSubdomain">TrackDrive Subdomain</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">https://</span>
                  <Input
                    id="trackdriveSubdomain"
                    value={settings.trackdriveSubdomain}
                    onChange={(e) => updateField('trackdriveSubdomain', e.target.value)}
                    placeholder="grovlabs"
                    className="max-w-[200px]"
                  />
                  <span className="text-sm text-muted-foreground">.trackdrive.com</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trackdrivePublicKey">Public Key</Label>
                  <Input
                    id="trackdrivePublicKey"
                    value={settings.trackdrivePublicKey}
                    onChange={(e) => updateField('trackdrivePublicKey', e.target.value)}
                    placeholder="Your TrackDrive public key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trackdrivePrivateKey">Private Key</Label>
                  <div className="relative">
                    <Input
                      id="trackdrivePrivateKey"
                      type={showPassword ? 'text' : 'password'}
                      value={settings.trackdrivePrivateKey}
                      onChange={(e) => updateField('trackdrivePrivateKey', e.target.value)}
                      placeholder="Your TrackDrive private key"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Find your API keys in TrackDrive under Settings → API Keys
              </p>
            </CardContent>
          </Card>

          {/* Discord Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Discord Notifications
              </CardTitle>
              <CardDescription>
                Get notified in Discord for new applications, signed IOs, and other events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
                <Input
                  id="discordWebhookUrl"
                  value={settings.discordWebhookUrl}
                  onChange={(e) => updateField('discordWebhookUrl', e.target.value)}
                  placeholder="https://discord.com/api/webhooks/..."
                />
                <p className="text-xs text-muted-foreground">
                  Create a webhook in your Discord server: Server Settings → Integrations → Webhooks
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Service URLs */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Service URLs
              </CardTitle>
              <CardDescription>
                Configure the URLs for your deployed services (auto-detected in production)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dashboardUrl">Dashboard URL</Label>
                <Input
                  id="dashboardUrl"
                  value={settings.dashboardUrl}
                  onChange={(e) => updateField('dashboardUrl', e.target.value)}
                  placeholder="https://grovlabs-dashboard.onrender.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorPortalUrl">Vendor Portal URL</Label>
                <Input
                  id="vendorPortalUrl"
                  value={settings.vendorPortalUrl}
                  onChange={(e) => updateField('vendorPortalUrl', e.target.value)}
                  placeholder="https://grovlabs-vendor-portal.onrender.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qaAgentUrl">QA Agent (Backend) URL</Label>
                <Input
                  id="qaAgentUrl"
                  value={settings.qaAgentUrl}
                  onChange={(e) => updateField('qaAgentUrl', e.target.value)}
                  placeholder="https://grovlabs-qa-agent.onrender.com"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                These URLs are used for internal API calls and email links. Leave blank to use defaults.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveSettings} disabled={saving} size="lg">
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Settings'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
