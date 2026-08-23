export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(
      `${process.env.QA_AGENT_URL || 'http://localhost:3003'}/onboarding/admin/agreement/${params.id}/download`,
      { headers: { 'Accept': 'text/html' } }
    )
    if (!res.ok) {
      const text = await res.text()
      console.error('Agreement download error:', res.status, text)
      return NextResponse.json({ error: 'Failed to fetch agreement' }, { status: res.status })
    }
    const html = await res.text()
    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error: any) {
    console.error('Agreement download proxy error:', error)
    return NextResponse.json({ error: 'Failed to fetch agreement' }, { status: 500 })
  }
}
