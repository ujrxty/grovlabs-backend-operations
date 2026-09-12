'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Bell, Plus, Trash2 } from 'lucide-react'

interface AlertRule {
  id: string
  name: string
  metric: string
  condition: string
  threshold: number
  enabled: boolean
}

const SAMPLE_RULES: AlertRule[] = [
  { id: '1', name: 'Accept Rate Drop', metric: 'accept_rate', condition: 'below', threshold: 20, enabled: true },
  { id: '2', name: 'Duplicate Spike', metric: 'duplicate_rate', condition: 'above', threshold: 15, enabled: true },
  { id: '3', name: 'Low Bid Alert', metric: 'avg_bid', condition: 'below', threshold: 15, enabled: false },
]

const METRICS = [
  { value: 'accept_rate', label: 'Accept Rate (%)' },
  { value: 'duplicate_rate', label: 'Duplicate Rate (%)' },
  { value: 'avg_bid', label: 'Average Bid ($)' },
  { value: 'total_pings', label: 'Total Pings' },
  { value: 'latency_ms', label: 'Latency (ms)' },
]

export default function AlertsPage() {
  const [rules, setRules] = useState<AlertRule[]>(SAMPLE_RULES)
  const [showForm, setShowForm] = useState(false)
  const [newRule, setNewRule] = useState({
    name: '',
    metric: 'accept_rate',
    condition: 'below',
    threshold: 0,
  })

  const toggleRule = (id: string) => {
    setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r))
  }

  const deleteRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id))
  }

  const addRule = () => {
    if (!newRule.name || newRule.threshold === 0) return
    setRules([...rules, {
      id: Date.now().toString(),
      name: newRule.name,
      metric: newRule.metric,
      condition: newRule.condition,
      threshold: newRule.threshold,
      enabled: true,
    }])
    setNewRule({ name: '', metric: 'accept_rate', condition: 'below', threshold: 0 })
    setShowForm(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Alert
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Alert Rule</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Alert Name</Label>
                <Input
                  placeholder="e.g., Accept Rate Drop"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Metric</Label>
                <Select value={newRule.metric} onValueChange={(v) => setNewRule({ ...newRule, metric: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRICS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={newRule.condition} onValueChange={(v) => setNewRule({ ...newRule, condition: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Goes Above</SelectItem>
                    <SelectItem value="below">Goes Below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Threshold</Label>
                <Input
                  type="number"
                  placeholder="e.g., 20"
                  value={newRule.threshold || ''}
                  onChange={(e) => setNewRule({ ...newRule, threshold: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={addRule}>Create Alert</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alert Rules</CardTitle>
          <CardDescription>Active alerts will send notifications when triggered</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Metric</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>{METRICS.find(m => m.value === rule.metric)?.label || rule.metric}</TableCell>
                  <TableCell className="capitalize">{rule.condition}</TableCell>
                  <TableCell>{rule.threshold}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'} className={rule.enabled ? 'bg-emerald-500' : ''}>
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                      <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No alert rules configured
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">
            <strong className="text-amber-500">Note:</strong> Alert notifications will be sent via Telegram and Discord when configured.
            Backend persistence coming soon.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
