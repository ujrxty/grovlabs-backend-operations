'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layouts/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CheckCircle, XCircle, MoreHorizontal, RefreshCw, Clock, Building2 } from 'lucide-react'

const QA_AGENT_URL = process.env.NEXT_PUBLIC_QA_AGENT_URL || 'http://localhost:3003'

interface Application {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  website?: string
  traffic_types: string
  estimated_volume?: string
  status: string
  created_at: string
  campaign: {
    name: string
    industry: string
  }
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function ApplicationsContent() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchApplications = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${QA_AGENT_URL}/onboarding/admin/applications`)
      const data = await res.json()
      setApplications(data.applications || [])
    } catch (err) {
      console.error('Failed to fetch applications:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchApplications()
  }, [])

  const handleApprove = async (id: string) => {
    setActionLoading(id)
    try {
      await fetch(`${QA_AGENT_URL}/onboarding/admin/applications/${id}/approve`, {
        method: 'POST',
      })
      fetchApplications()
    } catch (err) {
      console.error('Approve failed:', err)
    }
    setActionLoading(null)
  }

  const handleReject = async (id: string, reason: string) => {
    setActionLoading(id)
    try {
      await fetch(`${QA_AGENT_URL}/onboarding/admin/applications/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      fetchApplications()
    } catch (err) {
      console.error('Reject failed:', err)
    }
    setActionLoading(null)
  }

  const pendingCount = applications.filter(a => a.status === 'pending').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendor Applications"
        description={`${pendingCount} pending application${pendingCount !== 1 ? 's' : ''} awaiting review`}
        icon={Building2}
        actions={
          <Button variant="outline" size="sm" onClick={fetchApplications} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              Loading applications...
            </div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No applications found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Traffic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{app.company_name}</div>
                        {app.website && (
                          <a
                            href={app.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-primary"
                          >
                            {app.website}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{app.contact_name}</div>
                        <div className="text-xs text-muted-foreground">{app.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{app.campaign.name}</div>
                        <div className="text-xs text-muted-foreground">{app.campaign.industry}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {app.traffic_types || 'N/A'}
                        {app.estimated_volume && (
                          <span className="text-muted-foreground"> ({app.estimated_volume})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[app.status] || ''}>
                        {app.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {app.status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {app.status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(app.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {app.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(app.id)}
                            disabled={actionLoading === app.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={actionLoading === app.id}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleReject(app.id, 'traffic_type')}>
                                Traffic type mismatch
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(app.id, 'low_volume')}>
                                Volume too low
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(app.id, 'compliance')}>
                                Compliance concerns
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(app.id, 'duplicate')}>
                                Duplicate application
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleReject(app.id, 'other')}>
                                Other reason
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      {app.status !== 'pending' && (
                        <span className="text-xs text-muted-foreground">
                          {app.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
