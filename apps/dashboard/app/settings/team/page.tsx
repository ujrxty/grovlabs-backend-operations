'use client'

import { useState, useEffect } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2, Save, X, UsersRound, Mail, Shield, User, Briefcase, Users, Eye } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  admin: { label: 'Admin', color: 'text-red-700', bg: 'bg-red-100', icon: Shield },
  business_developer: { label: 'Business Developer', color: 'text-blue-700', bg: 'bg-blue-100', icon: Briefcase },
  affiliate_manager: { label: 'Affiliate Manager', color: 'text-green-700', bg: 'bg-green-100', icon: Users },
  buyer_manager: { label: 'Buyer Manager', color: 'text-purple-700', bg: 'bg-purple-100', icon: User },
  viewer: { label: 'Viewer', color: 'text-gray-700', bg: 'bg-gray-100', icon: Eye },
}

const getRoleConfig = (role: string) => ROLE_CONFIG[role] || ROLE_CONFIG.viewer

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Partial<TeamMember> & { password?: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team')
      const data = await res.json()
      setMembers(data.members || [])
    } catch (error) {
      console.error('Failed to fetch team:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditingMember({ email: '', name: '', role: 'admin', password: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (member: TeamMember) => {
    setEditingMember({ ...member, password: '' })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingMember(null)
  }

  const saveMember = async () => {
    if (!editingMember?.email?.trim() || !editingMember?.name?.trim()) return
    if (!editingMember.id && !editingMember.password?.trim()) {
      alert('Password is required for new members')
      return
    }
    setSaving(true)
    try {
      const isNew = !editingMember.id
      const res = await fetch('/api/team', {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMember),
      })
      if (res.ok) {
        await fetchMembers()
        closeDialog()
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to save')
      }
    } catch (error) {
      console.error('Failed to save member:', error)
    } finally {
      setSaving(false)
    }
  }

  const deleteMember = async (id: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return
    try {
      await fetch(`/api/team?id=${id}`, { method: 'DELETE' })
      await fetchMembers()
    } catch (error) {
      console.error('Failed to delete member:', error)
    }
  }

  const updateField = (field: string, value: any) => {
    setEditingMember((prev) => prev ? { ...prev, [field]: value } : null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground mt-1">Manage who has access to the admin dashboard</p>
        </div>
        <Button onClick={openCreateDialog} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add Team Member
        </Button>
      </div>

      {members.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <UsersRound className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No team members yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Get started by adding your first team member</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => {
            const roleConfig = getRoleConfig(member.role)
            const RoleIcon = roleConfig.icon
            return (
              <Card key={member.id} className="relative group hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                        {getInitials(member.name)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">{member.name}</h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate">{member.email}</span>
                      </div>
                      <div className="mt-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig.bg} ${roleConfig.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {roleConfig.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        Added {new Date(member.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(member)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMember(member.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingMember?.id ? 'Edit Team Member' : 'Add Team Member'}
            </DialogTitle>
            <DialogDescription>
              {editingMember?.id ? 'Update team member details and permissions.' : 'Add a new member to your team with dashboard access.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={editingMember?.name || ''}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={editingMember?.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="john@thebrokenwood.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                {editingMember?.id ? 'New Password' : 'Password'}
              </Label>
              <Input
                id="password"
                type="password"
                value={editingMember?.password || ''}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder={editingMember?.id ? 'Leave blank to keep current' : 'Enter password'}
              />
              {editingMember?.id && (
                <p className="text-xs text-muted-foreground">Leave blank to keep the current password</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={editingMember?.role || 'admin'}
                onValueChange={(v) => updateField('role', v)}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-red-600" />
                      Admin
                    </div>
                  </SelectItem>
                  <SelectItem value="business_developer">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-blue-600" />
                      Business Developer
                    </div>
                  </SelectItem>
                  <SelectItem value="affiliate_manager">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-600" />
                      Affiliate Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="buyer_manager">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-purple-600" />
                      Buyer Manager
                    </div>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4 text-gray-600" />
                      Viewer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={saving}>
              {saving ? 'Saving...' : editingMember?.id ? 'Save Changes' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardShell>
  )
}
