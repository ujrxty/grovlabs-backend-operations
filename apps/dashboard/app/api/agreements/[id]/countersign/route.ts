export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(
      `https://bsbwqa.abacusai.app/onboarding/admin/agreement/${params.id}/countersign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signed_by: session.user?.name || session.user?.email }),
      }
    )
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data?.error || 'Failed to countersign' }, { status: res.status })
    }
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Agreement countersign proxy error:', error)
    return NextResponse.json({ error: 'Failed to countersign agreement' }, { status: 500 })
  }
}
