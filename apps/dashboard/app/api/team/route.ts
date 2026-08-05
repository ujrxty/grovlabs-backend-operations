import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const members = await prisma.admin_user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        created_at: true,
      },
      orderBy: { created_at: 'asc' },
    })
    return NextResponse.json({ members })
  } catch (error: any) {
    console.error('Failed to fetch team:', error?.message)
    return NextResponse.json({ members: [] })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { email, name, password, role } = body

    if (!email?.trim() || !name?.trim() || !password?.trim()) {
      return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 })
    }

    const existing = await prisma.admin_user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 400 })
    }

    const password_hash = await bcrypt.hash(password, 12)
    const member = await prisma.admin_user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password_hash,
        role: role || 'admin',
      },
    })

    return NextResponse.json({ success: true, member: { id: member.id, email: member.email, name: member.name } })
  } catch (error: any) {
    console.error('Failed to create team member:', error?.message)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { id, email, name, password, role } = body

    if (!id) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    if (!email?.trim() || !name?.trim()) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    const updateData: any = {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role: role || 'admin',
    }

    if (password?.trim()) {
      updateData.password_hash = await bcrypt.hash(password, 12)
    }

    const member = await prisma.admin_user.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ success: true, member: { id: member.id, email: member.email, name: member.name } })
  } catch (error: any) {
    console.error('Failed to update team member:', error?.message)
    return NextResponse.json({ error: 'Failed to update team member' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const id = request.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Member ID required' }, { status: 400 })

    await prisma.admin_user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete team member:', error?.message)
    return NextResponse.json({ error: 'Failed to delete team member' }, { status: 500 })
  }
}
