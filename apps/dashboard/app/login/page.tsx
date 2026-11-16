'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight } from 'lucide-react'

const LIME = '#c4ff00'
// Left: publishers, right: buyers, the GrovLabs hub in the middle. Paths are drawn hub-ward and out again.
const PUBS = [80, 170, 260, 350, 440]
const BUYERS = [110, 200, 290, 380, 470]
const VERTICALS = ['Plumbing', 'Roofing', 'HVAC', 'Pest Control', 'Medicare', 'Home Insurance', 'Final Expense', 'ACA']

/** Animated pay-per-call network: calls travel from publishers, through the hub, to buyers. Pure SVG/CSS. */
function CallNetwork() {
  const hub = { x: 300, y: 275 }
  const inPaths = PUBS.map((y) => `M 40 ${y} C 170 ${y}, 190 ${hub.y}, ${hub.x} ${hub.y}`)
  const outPaths = BUYERS.map((y) => `M ${hub.x} ${hub.y} C 410 ${hub.y}, 430 ${y}, 560 ${y}`)
  return (
    <svg viewBox="0 0 600 550" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="gl-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={LIME} stopOpacity=".55" />
          <stop offset="100%" stopColor={LIME} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gl-line" x1="0" x2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".05" />
          <stop offset="50%" stopColor={LIME} stopOpacity=".35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity=".05" />
        </linearGradient>
        <filter id="gl-glow"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>

      {[...inPaths, ...outPaths].map((d, i) => <path key={i} d={d} fill="none" stroke="url(#gl-line)" strokeWidth="1.2" />)}

      {/* calls in flight */}
      {inPaths.map((d, i) => (
        <g key={`in${i}`}>
          <circle r="4" fill={LIME} filter="url(#gl-glow)"><animateMotion dur={`${2.6 + i * 0.37}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" path={d} /></circle>
          <circle r="2.2" fill="#fff"><animateMotion dur={`${2.6 + i * 0.37}s`} begin={`${i * 0.55}s`} repeatCount="indefinite" path={d} /></circle>
        </g>
      ))}
      {outPaths.map((d, i) => (
        <g key={`out${i}`}>
          <circle r="4" fill={LIME} filter="url(#gl-glow)"><animateMotion dur={`${2.4 + i * 0.41}s`} begin={`${0.9 + i * 0.6}s`} repeatCount="indefinite" path={d} /></circle>
          <circle r="2.2" fill="#fff"><animateMotion dur={`${2.4 + i * 0.41}s`} begin={`${0.9 + i * 0.6}s`} repeatCount="indefinite" path={d} /></circle>
        </g>
      ))}

      {/* endpoints */}
      {PUBS.map((y, i) => <g key={`p${i}`}><circle cx="40" cy={y} r="7" fill="#0b0b0b" stroke="#ffffff" strokeOpacity=".25" /><circle cx="40" cy={y} r="2.5" fill="#fff" fillOpacity=".7" /></g>)}
      {BUYERS.map((y, i) => <g key={`b${i}`}><circle cx="560" cy={y} r="7" fill="#0b0b0b" stroke={LIME} strokeOpacity=".5" /><circle cx="560" cy={y} r="2.5" fill={LIME} className="gl-blink" style={{ animationDelay: `${i * 0.5}s` }} /></g>)}
      <text x="22" y="40" textAnchor="start" fill="#ffffff" fillOpacity=".35" fontSize="11" letterSpacing="3">PUBLISHERS</text>
      <text x="578" y="40" textAnchor="end" fill="#ffffff" fillOpacity=".35" fontSize="11" letterSpacing="3">BUYERS</text>

      {/* hub */}
      <circle cx={hub.x} cy={hub.y} r="90" fill="url(#gl-hub)" className="gl-breathe" />
      <circle cx={hub.x} cy={hub.y} r="46" fill="#070707" stroke={LIME} strokeOpacity=".6" />
      <circle cx={hub.x} cy={hub.y} r="58" fill="none" stroke={LIME} strokeOpacity=".18" strokeDasharray="2 7" className="gl-spin" style={{ transformOrigin: `${hub.x}px ${hub.y}px` }} />
      <text x={hub.x} y={hub.y + 9} textAnchor="middle" fill={LIME} fontSize="28" fontWeight="800" fontFamily="var(--font-display)">G</text>
    </svg>
  )
}

const LOGIN_CSS = `
        .gl-grain { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); opacity: .05; }
        .gl-dots { background-image: radial-gradient(rgba(255,255,255,.09) 1px, transparent 1px); background-size: 26px 26px; mask: radial-gradient(ellipse 65% 70% at 35% 50%, #000, transparent 75%); }
        .gl-breathe { animation: gl-breathe 3.6s ease-in-out infinite; transform-origin: 300px 275px; }
        .gl-spin { animation: gl-spin 24s linear infinite; }
        .gl-blink { animation: gl-blink 2.2s ease-in-out infinite; }
        .gl-marquee { animation: gl-marquee 38s linear infinite; }
        .gl-in { animation: gl-in .8s cubic-bezier(.2,.7,.2,1) both; }
        @keyframes gl-breathe { 50% { opacity: .55; transform: scale(1.08); } }
        @keyframes gl-spin { to { transform: rotate(360deg); } }
        @keyframes gl-blink { 50% { opacity: .25; } }
        @keyframes gl-marquee { to { transform: translateX(-50%); } }
        @keyframes gl-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .gl-breathe, .gl-spin, .gl-blink, .gl-marquee { animation: none; } }
      `

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await signIn('credentials', { email: email.trim().toLowerCase(), password, redirect: false })
      if (result?.error) { setError('Invalid email or password'); setLoading(false) }
      else router.replace('/')
    } catch {
      setError('An error occurred. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <style dangerouslySetInnerHTML={{ __html: LOGIN_CSS }} />
      <div className="gl-dots pointer-events-none absolute inset-0" />
      <div className="gl-grain pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[520px] w-[520px] rounded-full blur-[140px]" style={{ background: 'rgba(196,255,0,.10)' }} />

      <div className="relative grid min-h-screen lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* Left: brand + live network */}
        <section className="flex min-w-0 flex-col justify-between px-6 pb-6 pt-8 sm:px-12 lg:py-12">
          <div className="gl-in flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg font-display text-[18px] font-extrabold text-black" style={{ background: LIME, boxShadow: '0 0 30px -4px rgba(196,255,0,.7)' }}>G</span>
            <span className="font-display text-[17px] font-bold tracking-tight">GrovLabs<span style={{ color: LIME }}>.</span></span>
            <span className="ml-1 rounded-full border border-white/10 px-2 py-0.5 text-[10.5px] uppercase tracking-[0.18em] text-white/50">Admin</span>
          </div>

          <div className="gl-in mx-auto my-6 w-full max-w-[620px] lg:my-0" style={{ animationDelay: '.1s' }}>
            <div className="aspect-[600/550] w-full"><CallNetwork /></div>
          </div>

          <div className="gl-in hidden lg:block" style={{ animationDelay: '.2s' }}>
            <h2 className="max-w-[520px] font-display text-[44px] font-extrabold leading-[1.02] tracking-tight">
              Every call,<br />routed and <span style={{ color: LIME }}>accounted for.</span>
            </h2>
            <div className="mt-6 overflow-hidden [mask:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
              <div className="gl-marquee flex w-max gap-8 whitespace-nowrap text-[12px] uppercase tracking-[0.22em] text-white/35">
                {[...VERTICALS, ...VERTICALS].map((v, i) => <span key={i} className="flex items-center gap-8">{v}<span style={{ color: LIME }}>/</span></span>)}
              </div>
            </div>
          </div>
        </section>

        {/* Right: sign in */}
        <section className="flex items-center justify-center px-5 pb-12 sm:px-10 lg:py-12">
          <div className="gl-in w-full max-w-[420px]" style={{ animationDelay: '.15s' }}>
            <div className="rounded-[22px] p-px" style={{ background: 'linear-gradient(140deg, rgba(196,255,0,.55), rgba(255,255,255,.08) 35%, rgba(255,255,255,.04) 70%, rgba(196,255,0,.25))' }}>
              <form onSubmit={handleSubmit} className="rounded-[21px] bg-[#0a0a0a]/90 p-8 backdrop-blur-xl">
                <p className="text-[12px] uppercase tracking-[0.22em]" style={{ color: LIME }}>Control room</p>
                <h1 className="mt-2 font-display text-[30px] font-extrabold leading-tight tracking-tight">Welcome back.</h1>
                <p className="mt-1.5 text-[14px] text-white/50">Campaigns, vendors, QA and billing. Sign in to run the network.</p>

                {error && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13.5px] text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />{error}
                  </div>
                )}

                <label className="mt-6 block">
                  <span className="mb-1.5 block text-[12.5px] text-white/55">Email</span>
                  <input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@grovlabs.com"
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#c4ff00]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(196,255,0,.10)]" />
                </label>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[12.5px] text-white/55">Password</span>
                  <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••"
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-[#c4ff00]/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(196,255,0,.10)]" />
                </label>

                <button type="submit" disabled={loading}
                  className="group relative mt-6 flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl font-display text-[15px] font-bold text-black transition disabled:opacity-60"
                  style={{ background: LIME, boxShadow: '0 14px 40px -14px rgba(196,255,0,.8)' }}>
                  <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-white/50 opacity-0 transition-all duration-700 group-hover:left-[110%] group-hover:opacity-100" />
                  {loading ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                </button>
              </form>
            </div>
            <p className="mt-6 text-center text-[12px] text-white/30">Private admin · GrovLabs LLC</p>
          </div>
        </section>
      </div>
    </div>
  )
}
