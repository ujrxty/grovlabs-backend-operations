export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.QA_AGENT_URL || 'http://localhost:3003'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl?.searchParams?.get?.('token')?.trim?.()
    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }

    const res = await fetch(`${BACKEND_URL}/onboarding/io/${token}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: data?.error ?? data?.message ?? 'Failed to fetch IO terms' },
        { status: res.status }
      )
    }

    return NextResponse.json({ success: true, io: data })
  } catch (error: any) {
    console.error('Fetch IO terms error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to fetch IO terms' }, { status: 500 })
  }
}
