export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

function checkAuth(request: NextRequest): boolean {
  const pw = request.headers.get('x-admin-password') ?? ''
  return pw === (process.env.ADMIN_PASSWORD ?? '')
}

// GET - List all campaigns
export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Admin campaigns GET error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to fetch campaigns' }, { status: 500 })
  }
}

// POST - Create campaign
export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Admin campaigns POST error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to create campaign' }, { status: 500 })
  }
}
