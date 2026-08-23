import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GrovLabs - Vendor Portal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #050505 0%, #0a0a0a 50%, #050505 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              background: '#050505',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 48, fontWeight: 800, color: '#ffffff' }}>G</span>
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                width: 16,
                height: 16,
                background: '#c4ff00',
                borderRadius: '50%',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: '#ffffff',
              marginLeft: 24,
              letterSpacing: -2,
            }}
          >
            GrovLabs
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#ffffff',
            marginBottom: 16,
            letterSpacing: -2,
          }}
        >
          Vendor Portal
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 48,
          }}
        >
          Apply to become a GrovLabs vendor partner
        </div>

        {/* Accent line */}
        <div
          style={{
            width: 120,
            height: 6,
            background: 'linear-gradient(90deg, #c4ff00, #a3e635)',
            borderRadius: 3,
          }}
        />

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            fontSize: 20,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          portal.grovlabs.com
        </div>
      </div>
    ),
    { ...size }
  )
}
