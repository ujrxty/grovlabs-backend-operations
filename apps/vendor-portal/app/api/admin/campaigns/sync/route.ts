export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

function checkAuth(request: NextRequest): boolean {
  const pw = request.headers.get('x-admin-password') ?? ''
  return pw === (process.env.ADMIN_PASSWORD ?? '')
}

// POST - Pull active TrackDrive offers into the portal now
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Campaign sync error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 })
  }
}
