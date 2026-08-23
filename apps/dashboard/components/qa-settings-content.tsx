'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Save, Loader2, Plus, X, AlertTriangle, Clock, Target, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

interface QASettings {
  durationThresholds: Record<string, number>
  normalConfidenceThreshold: number
  highSensitivityConfidenceThreshold: number
  primaryTriggers: string[]
  secondaryTriggers: string[]
}

const DEFAULT_SETTINGS: QASettings = {
  durationThresholds: {
    'auto insurance': 120,
    'home insurance': 120,
    'solar': 120,
    'medicare': 300,
    default: 90,
  },
  normalConfidenceThreshold: 50,
  highSensitivityConfidenceThreshold: 30,
  primaryTriggers: [
    'you transferred me',
    'someone transferred me',
    'I was transferred',
    'you called me',
    'someone called me',
    "I didn't call you",
    'stop calling me',
    'why are you calling me',
    'how did you get my number',
  ],
  secondaryTriggers: [
    'what company is this',
    'who are you people',
    'this is a scam',
  ],
}

export function QASettingsContent() {
  const [settings, setSettings] = useState<QASettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newThresholdKey, setNewThresholdKey] = useState('')
  const [newThresholdValue, setNewThresholdValue] = useState('')
  const [newPrimaryTrigger, setNewPrimaryTrigger] = useState('')
  const [newSecondaryTrigger, setNewSecondaryTrigger] = useState('')

  useEffect(() => {
    fetch('/api/qa-settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
        }
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load QA settings')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/qa-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      const data = await res.json()
      if (data.error) {
        toast.error(data.error)
      } else {
        toast.success('QA settings saved successfully')
      }
    } catch {
      toast.error('Failed to save settings')
    }
    setSaving(false)
  }

  const addThreshold = () => {
    if (!newThresholdKey.trim() || !newThresholdValue) return
    const key = newThresholdKey.toLowerCase().trim()
    const value = parseInt(newThresholdValue, 10)
    if (isNaN(value) || value < 0) return
    setSettings(prev => ({
      ...prev,
      durationThresholds: { ...prev.durationThresholds, [key]: value },
    }))
    setNewThresholdKey('')
    setNewThresholdValue('')
  }

  const removeThreshold = (key: string) => {
    if (key === 'default') return
    setSettings(prev => {
      const { [key]: _, ...rest } = prev.durationThresholds
      return { ...prev, durationThresholds: rest }
    })
  }

  const updateThreshold = (key: string, value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) return
    setSettings(prev => ({
      ...prev,
      durationThresholds: { ...prev.durationThresholds, [key]: num },
    }))
  }

  const addPrimaryTrigger = () => {
    if (!newPrimaryTrigger.trim()) return
    const trigger = newPrimaryTrigger.trim().toLowerCase()
    if (settings.primaryTriggers.includes(trigger)) return
    setSettings(prev => ({
      ...prev,
      primaryTriggers: [...prev.primaryTriggers, trigger],
    }))
    setNewPrimaryTrigger('')
  }

  const removePrimaryTrigger = (trigger: string) => {
    setSettings(prev => ({
      ...prev,
      primaryTriggers: prev.primaryTriggers.filter(t => t !== trigger),
    }))
  }

  const addSecondaryTrigger = () => {
    if (!newSecondaryTrigger.trim()) return
    const trigger = newSecondaryTrigger.trim().toLowerCase()
    if (settings.secondaryTriggers.includes(trigger)) return
    setSettings(prev => ({
      ...prev,
      secondaryTriggers: [...prev.secondaryTriggers, trigger],
    }))
    setNewSecondaryTrigger('')
  }

  const removeSecondaryTrigger = (trigger: string) => {
    setSettings(prev => ({
      ...prev,
      secondaryTriggers: prev.secondaryTriggers.filter(t => t !== trigger),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QA Agent Settings"
        description="Configure cold transfer detection thresholds, triggers, and alert criteria"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        }
      />

      {/* Confidence Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Confidence Thresholds
          </CardTitle>
          <CardDescription>
            Minimum AI confidence score (0-100) required to flag a call as suspicious
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Normal Threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.normalConfidenceThreshold}
                onChange={e => setSettings(prev => ({ ...prev, normalConfidenceThreshold: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Calls scoring above this will be flagged for review
              </p>
            </div>
            <div className="space-y-2">
              <Label>High-Sensitivity Threshold (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.highSensitivityConfidenceThreshold}
                onChange={e => setSettings(prev => ({ ...prev, highSensitivityConfidenceThreshold: parseInt(e.target.value, 10) || 0 }))}
              />
              <p className="text-xs text-muted-foreground">
                Lower threshold for affiliates under enhanced monitoring
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duration Thresholds */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Duration Thresholds
          </CardTitle>
          <CardDescription>
            Minimum call duration (seconds) before QA analysis runs. Shorter calls are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {Object.entries(settings.durationThresholds).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Input
                  value={key}
                  disabled={key === 'default'}
                  className="flex-1 capitalize"
                  readOnly
                />
                <Input
                  type="number"
                  min={0}
                  value={value}
                  onChange={e => updateThreshold(key, e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground w-12">sec</span>
                {key !== 'default' && (
                  <Button variant="ghost" size="icon-sm" onClick={() => removeThreshold(key)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2 border-t">
            <Input
              placeholder="Campaign keyword (e.g., medicare)"
              value={newThresholdKey}
              onChange={e => setNewThresholdKey(e.target.value)}
              className="flex-1"
            />
            <Input
              type="number"
              placeholder="120"
              value={newThresholdValue}
              onChange={e => setNewThresholdValue(e.target.value)}
              className="w-24"
            />
            <Button variant="outline" size="sm" onClick={addThreshold}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            If a campaign name contains the keyword, that threshold is used. Otherwise "default" applies.
          </p>
        </CardContent>
      </Card>

      {/* Primary Triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Primary Triggers (High Confidence)
          </CardTitle>
          <CardDescription>
            Phrases that strongly indicate a cold transfer. AI looks for these exact phrases.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.primaryTriggers.map(trigger => (
              <Badge key={trigger} variant="destructive" className="flex items-center gap-1 py-1 px-2">
                "{trigger}"
                <button onClick={() => removePrimaryTrigger(trigger)} className="ml-1 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder='Add trigger phrase (e.g., "you called me")'
              value={newPrimaryTrigger}
              onChange={e => setNewPrimaryTrigger(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPrimaryTrigger()}
            />
            <Button variant="outline" onClick={addPrimaryTrigger}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Secondary Triggers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-amber-500" />
            Secondary Triggers (Medium Confidence)
          </CardTitle>
          <CardDescription>
            Phrases that may indicate issues but are less definitive. Require additional context.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {settings.secondaryTriggers.map(trigger => (
              <Badge key={trigger} variant="outline" className="flex items-center gap-1 py-1 px-2 border-amber-300 text-amber-700">
                "{trigger}"
                <button onClick={() => removeSecondaryTrigger(trigger)} className="ml-1 hover:opacity-70">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder='Add trigger phrase (e.g., "what company is this")'
              value={newSecondaryTrigger}
              onChange={e => setNewSecondaryTrigger(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addSecondaryTrigger()}
            />
            <Button variant="outline" onClick={addSecondaryTrigger}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <h4 className="font-medium mb-2">How QA Analysis Works</h4>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li>TrackDrive sends call webhook when call ends</li>
            <li>If duration meets threshold, recording is downloaded</li>
            <li>OpenAI Whisper transcribes the audio</li>
            <li>GPT-4o analyzes transcript for cold transfer patterns</li>
            <li>If confidence exceeds threshold, call is flagged</li>
            <li>Discord alert sent for flagged calls</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
