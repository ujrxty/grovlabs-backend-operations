import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'GrovLabs - Performance Marketing'
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
              width: 100,
              height: 100,
              background: '#050505',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          >
            <span style={{ fontSize: 60, fontWeight: 800, color: '#ffffff' }}>G</span>
            <div
              style={{
                position: 'absolute',
                bottom: 14,
                right: 14,
                width: 20,
                height: 20,
                background: '#c4ff00',
                borderRadius: '50%',
              }}
            />
          </div>
          <span
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
              marginLeft: 28,
              letterSpacing: -3,
            }}
          >
            GrovLabs
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            fontWeight: 600,
            color: '#c4ff00',
            marginBottom: 16,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          Performance Marketing
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255,255,255,0.6)',
            marginBottom: 48,
          }}
        >
          Pay-per-call lead generation at scale
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
          grovlabs.com
        </div>
      </div>
    ),
    { ...size }
  )
}
