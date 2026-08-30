# CLAUDE.md

Full-stack monorepo for **GrovLabs** — a US performance marketing and
lead generation company. Deployed to Render as a single Blueprint.

## Monorepo Structure

```
apps/
  landing/           Next.js 14 — Marketing site (grovlabs.com)
  dashboard/         Next.js 14 — Admin dashboard (internal)
  vendor-portal/     Next.js 14 — Vendor self-service portal
  qa-agent/
    nodejs_space/    NestJS — Backend API, Telegram bot, TrackDrive integration

render.yaml          Render Blueprint — all 4 services + shared PostgreSQL
```

All apps share one PostgreSQL database via Prisma. The schema lives in
`apps/qa-agent/nodejs_space/prisma/schema.prisma` — **do not duplicate**.

## Commands

Each app has its own package.json. Run from the app directory:

```bash
# Landing Page (apps/landing)
npm run dev          # dev server :3000
npm run build        # production build

# Dashboard (apps/dashboard)
npm run dev          # dev server :3000
npx prisma db seed   # seed admin users

# Vendor Portal (apps/vendor-portal)
npm run dev          # dev server :3000

# QA Agent (apps/qa-agent/nodejs_space)
npm run start:dev    # NestJS dev with hot reload
npm run build        # compile TypeScript to dist/
npm run start:prod   # run compiled dist/main.js
```

### Never run `npm run build` while the dev server is running

Next.js `build` overwrites `.next/` and corrupts a running dev server.
Stop dev first, then: `rm -rf .next && npm run build`

## Deployment (Render Blueprint)

```bash
git push origin master   # auto-deploys all services
```

Manual deploy: Render Dashboard → select service → Manual Deploy

### Environment Variables (set in Render)

**All services:**
- `DATABASE_URL` — auto-injected from `grovlabs-database`
- `NODE_ENV=production`

**Landing Page (`grovlabs-landing`):**
- `NEXT_PUBLIC_DASHBOARD_URL` — URL to dashboard for Login button

**Dashboard (`grovlabs-dashboard`):**
- `NEXTAUTH_SECRET` — auto-generated
- `NEXTAUTH_URL` — the dashboard's public URL
- `RESEND_API_KEY` — for sending invoices/emails
- `TD_PUBLIC_KEY` — TrackDrive API (for billing page)
- `TD_PRIVATE_KEY` — TrackDrive API (for billing page)
- `TD_SUBDOMAIN` — e.g. `grovlabs`
- `QA_AGENT_URL` — e.g. `https://api.grovlabs.com`

**QA Agent (`grovlabs-qa-agent`):**
- `TRACKDRIVE_PUBLIC_KEY` — TrackDrive API public key
- `TRACKDRIVE_PRIVATE_KEY` — TrackDrive API private key
- `TRACKDRIVE_BASE_URL` — e.g. `https://grovlabs.trackdrive.com`
- `OPENAI_API_KEY` — for Whisper transcription + GPT-4o analysis
- `DISCORD_WEBHOOK_URL` — for QA flagged call alerts
- `TELEGRAM_BOT_TOKEN` — from @BotFather (for onboarding notifications)
- `TELEGRAM_CHAT_ID` — group/channel for notifications
- `VENDOR_PORTAL_URL` — e.g. `https://grovlabs-vendor-portal.onrender.com`

## Vendor Onboarding Flow

```
1. Vendor browses campaigns on Vendor Portal
2. Submits application (company info, traffic types, campaigns)
3. QA Agent saves to DB, sends Telegram notification with Approve/Reject buttons
4. Admin taps "Approve" on Telegram (or uses Dashboard)
5. QA Agent creates Insertion Order, emails vendor sign link
6. Vendor signs IO on Vendor Portal
7. Telegram alert with "Countersign" button sent to admin
8. Admin countersigns → TrackDrive source created → Welcome email sent
```

Key models: `campaign`, `vendor_application`, `vendor_profile`, `insertion_order`, `lead_purchase_agreement`

## Database Schema

Schema in `apps/qa-agent/nodejs_space/prisma/schema.prisma`. Key models:

- **campaign** — Available campaigns vendors can apply to
- **vendor_application** — Submitted applications (pending → approved/rejected)
- **vendor_profile** — Approved vendors with contact info and TD source ID
- **insertion_order** — Contracts per vendor/campaign, signed by both parties
- **lead_purchase_agreement** — Master LPA per vendor, signed once
- **call** / **transcript** / **qa_analysis** — Call QA pipeline
- **affiliate** / **flag** — Affiliate trust scoring and compliance flags

Run migrations: `npx prisma db push` (from qa-agent/nodejs_space)

## QA Agent API

NestJS backend at `apps/qa-agent/nodejs_space`. Key modules:

- **OnboardingModule** — Application CRUD, IO/agreement signing, Telegram callbacks
- **TrackDriveModule** — API client for calls, publishers, traffic sources
- **TelegramModule** — Send alerts, inline keyboard callbacks
- **BotModule** — Telegram webhook handler for button callbacks
- **CallsModule** — Call ingestion and QA pipeline
- **AnalysisModule** — AI-powered call transcript analysis

Telegram callback patterns:
- `oa_{shortId}` — Approve single application
- `or_{shortId}` — Show rejection reason picker
- `oaa_{groupId}` — Approve all in group
- `ocs_{shortId}` — Countersign IO
- `acs_{shortId}` — Countersign Lead Purchase Agreement

## Landing Page (apps/landing)

Marketing site for grovlabs.com. Next.js 14 + Tailwind v4.

### Architecture

```
app/layout.tsx        fonts, metadata, OG tags, favicon
app/page.tsx          section order
app/globals.css       Tailwind v4 theme (@theme block)
lib/content.ts        ALL copy and data — single source of truth
components/           one per section
public/logo.png       GrovLabs logo
public/favicon.svg    SVG favicon
```

### Branding Assets

- **Logo:** `public/logo.png` — GrovLabs logo
- **Favicon:** `public/favicon.svg` — Black square with white "G" and lime dot
- **Header:** `components/Nav.tsx` — logo + "GrovLabs" text in Wordmark component

The favicon (`public/favicon.svg` and `app/icon.svg`) is consistent across all apps:
dashboard, vendor-portal, and landing. Same as grovlabs.com (agency website).

### OpenGraph Images

Dynamic OG images for link previews in `app/opengraph-image.tsx` (all apps).
Uses `next/og` ImageResponse with dark theme, GrovLabs branding, and lime accents.

Tailwind v4 — **no `tailwind.config`**. Theme in `@theme` block in globals.css.

### Design System

- Warm paper base (#faf8f5), near-black text (#1a1a1a)
- **One** copper accent (#b87333) — links, buttons, highlights
- Fonts: Instrument Sans (body) + IBM Plex Mono (figures/labels)
- No gradient text, minimal shadows, structure via borders/spacing

### Content Integrity

**Never invent** customers, quotes, case studies, or performance figures.
Source notes in `lib/content.ts`: `verified`, `derived`, `standard`, `TODO`.
Unknown values are `null` and render as em-dash or "quoted on request".

## Vendor Portal (apps/vendor-portal)

Self-service portal for vendors. Branded with GrovLabs colors.

Features:
- Browse active campaigns
- Submit applications
- Check application status (via status token)
- Sign Insertion Orders
- Sign Lead Purchase Agreements

Key components:
- `components/portal-header.tsx` — GrovLabs branded nav
- `app/page.tsx` — Campaign listing
- `app/status/page.tsx` — Status checker
- `app/io/sign/[token]/page.tsx` — IO signing
- `app/agreement/sign/[token]/page.tsx` — LPA signing

## Dashboard (apps/dashboard)

Internal admin dashboard. Next.js 14 + NextAuth. Supports light/dark themes.

Default admin users (from seed):
- rayan@grovlabs.com / Admin123!
- uj@grovlabs.com / GrovLabs26!

### Dark Theme Guidelines

**Never use hardcoded light colors.** Use theme-aware classes:
- `bg-background` instead of `bg-white` for surfaces
- `bg-muted` or `bg-muted/50` for subtle backgrounds
- `border` instead of `border-gray-200`
- `text-foreground` / `text-muted-foreground` for text

For colored elements needing dark variants:
```tsx
// Bad
className="bg-amber-50 border-amber-200"

// Good
className="bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
```

Exceptions (OK to use `bg-white`):
- `bg-white/10` etc. — opacity-based glass effects work in dark mode
- Toggle switch thumbs — need contrast against track

Features:
- Campaign management (CRUD, activate/deactivate)
- Application review (approve/reject)
- Vendor management
- IO/Agreement management and countersigning
- Call QA review and logs
- QA Settings (thresholds, triggers, schedule)
- Billing (vendor payouts, buyer invoices)
- Analytics and reporting

### QA Settings (`/qa-settings`)

Configurable settings stored in `system_settings` table:
- **Confidence thresholds** — normal and high-sensitivity
- **Duration thresholds** — per campaign type (medicare, solar, etc.)
- **Primary/Secondary triggers** — phrases indicating cold transfers
- **Schedule** — start hour, end hour, timezone for QA bot runs

### Billing (`/billing`)

Two tabs:
- **Vendor Payouts** — generate payout reports for vendors
- **Buyer Invoices** — generate and email invoices to buyers

Requires TrackDrive credentials (`TD_*` env vars) and Resend (`RESEND_API_KEY`).

## Email Templates

Professional email templates in `apps/dashboard/lib/email-templates.ts`.

Uses Resend for sending. Templates available:
- `invoiceEmail` — buyer invoices with campaign breakdown
- `welcomeEmail` — IO executed / welcome to network
- `signRequestEmail` — IO/MSA signing requests
- `applicationStatusEmail` — approved/rejected notifications
- `notificationEmail` — generic notifications

Design: Clean light theme with dark header, GrovLabs branding.

## Call QA System

Automatic call quality analysis pipeline:

1. TrackDrive webhook triggers on call end
2. If duration meets threshold, recording downloaded
3. OpenAI Whisper transcribes audio
4. GPT-4o analyzes for cold transfer patterns
5. Flagged calls sent to Discord with details
6. All results stored in `qa_analysis` table

Key modules in QA Agent:
- **QASettingsModule** — configurable thresholds and triggers
- **TranscriptionModule** — Whisper API integration
- **AnalysisModule** — GPT-4o cold transfer detection
- **DiscordModule** — flagged call alerts

Test endpoints:
- `GET /webhooks/test/recent-calls` — list recent TrackDrive calls
- `POST /webhooks/test/process-call` — manually process a call
- `POST /webhooks/fix-durations` — backfill duration from stored trackdrive_data

### Known TrackDrive Webhook Issue

TrackDrive sometimes sends webhooks with empty `total_duration` and `recording_url` even for connected calls. This happens when the webhook fires before TrackDrive finishes processing.

**Workaround:** Consider using "Recording Ready" trigger instead of "Call Ended" in TrackDrive webhook config.

## N2N (Network-to-Network) Partnerships

Module for managing bidirectional partnerships with other networks.

Key endpoints:
- `POST /n2n/applications` — submit partner application
- `GET /n2n/applications` — list applications
- `POST /n2n/applications/:id/approve` — approve application
- `POST /n2n/ios/:id/send-sign-request` — send IO signing email
- `GET /n2n/io/sign/:token/html` — view IO document (token-based)
- `POST /n2n/io/sign/:token` — sign IO

Uses Resend for emails. Templates in `n2n.service.ts` with company details from `config/email.config.ts`.

## Telegram Bot Setup

1. Create bot via @BotFather, get token
2. Get chat ID (add bot to group, send message, check updates API)
3. Set webhook: `https://api.telegram.org/bot{TOKEN}/setWebhook?url={QA_AGENT_URL}/api/bot/webhook`
4. Add env vars to QA Agent on Render

## TrackDrive Integration

QA Agent connects to TrackDrive API for:
- Creating traffic sources (vendors)
- Fetching call data
- Pausing/unpausing sources
- Listing campaigns, publishers, buyers

API uses Basic Auth with public/private key pair.

## Common Issues

**Prisma version mismatch:** Always use `./node_modules/.bin/prisma`, never `npx prisma` (npx may pull wrong version).

**devDependencies not installed in prod:** Move build tools (typescript, @types/*, prisma) to dependencies.

**tsconfig.build.json missing include:** Must have `"include": ["src/**/*.ts"]` for tsc to find files.

**Path alias (@/) not resolving:** Needs `baseUrl: "."` in tsconfig.json.

## Related Projects (Outside Monorepo)

### Revenue Wallpaper

Location: `C:\E drive Data\revenue-wallpaper`

Standalone Node.js app that displays TrackDrive revenue as dynamic Windows wallpaper.

```bash
cd "C:\E drive Data\revenue-wallpaper"
npm start              # update once
npm run watch          # continuous (every 5 min)
node index.js goal 50000 Monthly Goal  # set goal
```

Auto-starts with Windows via VBS script in Startup folder.
