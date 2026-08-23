export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { setVerificationCode } from '@/lib/verification-store'
import { sendNotificationEmail, emailTemplate } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, email } = body ?? {}

    if (!token?.trim?.()) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }
    if (!email?.trim?.() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? '')) {
      return NextResponse.json({ success: false, error: 'Valid email is required' }, { status: 400 })
    }

    // Verify the IO exists and email matches
    const io = await prisma.insertion_order.findUnique({
      where: { sign_token: token?.trim?.() },
      include: {
        vendor: { select: { email: true, company_name: true } },
      },
    })

    if (!io) {
      return NextResponse.json({ success: false, error: 'Invalid signing link' }, { status: 404 })
    }

    if (io?.vendor?.email?.toLowerCase?.() !== email?.trim?.()?.toLowerCase?.()) {
      return NextResponse.json({ success: false, error: 'Email does not match the vendor on file' }, { status: 403 })
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    await setVerificationCode(token?.trim?.(), code, email?.trim?.()?.toLowerCase?.())

    // Send code via email
    const codeContent = `
      <p style="color: #374151;">Your verification code for GrovLabs Inc IO signing is:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-family: monospace; font-size: 32px; letter-spacing: 8px; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; font-weight: bold; color: #7c3aed;">${code}</span>
      </div>
      <p style="color: #6b7280; font-size: 13px;">This code expires in 15 minutes. Do not share this code with anyone.</p>
    `
    const notifId = process.env.NOTIF_ID_IO_EMAIL_VERIFICATION_CODE ?? ''
    console.log('Sending verification email to:', email?.trim?.()?.toLowerCase?.(), 'notifId:', notifId)
    const emailResult = await sendNotificationEmail({
      notificationId: notifId,
      subject: 'GrovLabs Inc - IO Verification Code',
      body: emailTemplate('Verification Code', codeContent),
      recipientEmail: email?.trim?.()?.toLowerCase?.() ?? '',
    })
    console.log('Verification email result:', JSON.stringify(emailResult))

    if (emailResult?.success === false && !(emailResult as any)?.disabled) {
      return NextResponse.json({ success: false, error: 'Failed to send verification email. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Send code error:', error?.message ?? error)
    return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 })
  }
}
