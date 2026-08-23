export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

function checkAuth(request: NextRequest): boolean {
  const pw = request.headers.get('x-admin-password') ?? ''
  return pw === (process.env.ADMIN_PASSWORD ?? '')
}

// PATCH - Edit campaign
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Admin campaign PATCH error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to update campaign' }, { status: 500 })
  }
}

// DELETE - Delete campaign
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns/${params.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Admin campaign DELETE error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to delete campaign' }, { status: 500 })
  }
}
