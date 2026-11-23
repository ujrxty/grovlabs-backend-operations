export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

function checkAuth(request: NextRequest): boolean {
  const pw = request.headers.get('x-admin-password') ?? ''
  return pw === (process.env.ADMIN_PASSWORD ?? '')
}

// POST - Merge this campaign into another (moves applications + IOs, archives this one)
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!checkAuth(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await request.json()
    const res = await fetch(`${BACKEND_URL}/onboarding/admin/campaigns/${params.id}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ into_id: body?.into_id }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error: any) {
    console.error('Campaign merge error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Merge failed' }, { status: 500 })
  }
}
