# CLAUDE.md

Marketing site for **The Broken Wood** — a US performance marketing and lead
generation company. Single static page, Next.js App Router.

Rebuilt from the live site at thebrokenwood.com. The audience is carriers,
agencies and publishers evaluating a lead partner — not consumers.

## Commands

```bash
npm run dev     # dev server on :3000
npm run build   # production build (static prerender)
npm start       # serve the production build
```

### Never run `npm run build` while the dev server is running

`next build` overwrites `.next/` underneath the running dev server and
corrupts it. The page then 500s with `__webpack_modules__[moduleId] is not a
function` or `Cannot find module './###.js'`. Same thing happens after
`npm install`/`uninstall` while dev is up.

Recovery, and the correct order:

```bash
# stop dev server first, then:
rm -rf .next && npm run build
```

## Architecture

```
app/layout.tsx        fonts, metadata, OG tags
app/page.tsx          section order — the whole page is composed here
app/globals.css       Tailwind v4 theme + all shared classes
lib/content.ts        ALL copy and data. Single source of truth.
components/           one per section, plus shared primitives
```

Tailwind v4 — there is **no `tailwind.config`**. Theme tokens live in the
`@theme` block at the top of `app/globals.css`.

`lib/content.ts` drives everything. The hero, the inventory table and the
qualifier all read the same arrays, so they cannot drift apart. Change copy
there, not in components.

## Content integrity — the important part

This site had fabricated content in an early draft (invented testimonials
with invented job titles). It was removed. **Do not reintroduce anything of
that kind.**

Rules:

- **Never invent** a customer, quote, case study, result, client logo, or
  performance figure.
- Every entry in `lib/content.ts` carries a source note. Keep the convention:
  - `verified` — taken from thebrokenwood.com
  - `derived` — follows factually from verified data (e.g. geo is `US`
    because SSDI/ACA/Medicare are US-only programmes)
  - `standard` — true of the industry regardless of operator (how CPA vs CPL
    works, what TCPA consent requires)
  - `TODO` / `claim` — unsubstantiated; must be marked in the UI
- Unknown values are `null` and render as an em-dash or "quoted on request".
  Never fill a gap with a plausible-looking number.
- Unverified claims carried over from the current site (the 37,800 customer
  figure, the 4.9 Clutch rating, the partner badges) render inside a
  collapsed `<details>` in `Compliance.tsx` labelled **Unverified**. They are
  not headline stats. Substantiate or delete them — don't promote them.
- `Placeholder.tsx` is **deliberately ugly** (dashed border, hatched fill,
  a "PLACEHOLDER" tag). If one reaches production it should be obvious.
  Don't restyle it to look intentional.
- The live dashboards use illustrative numbers and are captioned
  *"Interface preview — sample values, not reported performance."*
  Keep that caption on any component showing sample data.

## Design conventions

Warm paper base, near-black text, **one** copper accent from the logo.

- Palette and fonts: `@theme` in `globals.css`. Copper is for links, the
  accent rule, primary buttons, and the one highlighted word in the hero.
  Don't add a second accent hue.
- **No gradient-filled text.** Flat colour only.
- Type scale is deliberately wide — 10.5px mono labels against an 84px
  headline. That contrast is what stops the page reading as generic. Don't
  flatten it toward a uniform mid-size.
- Structure comes from rules, borders and spacing, not from shadows.
  `.card` / `.card-raised` shadows are near-invisible on purpose.
- One dark espresso band (`.band`) in the hero live strip and the delivery
  section, for rhythm. It is not a base colour — don't extend it.
- Figures use `font-variant-numeric: tabular-nums` so columns align.
- Fonts: Instrument Sans (display/body) + IBM Plex Mono (all figures, labels,
  codes). Both via `next/font`, self-hosted.

## Live / interactive components

`LiveWire.tsx` (hero strip) and `ReportingPreview.tsx` (reporting section)
both animate. They follow the same pattern — **keep it** if you add another:

```ts
const live = onScreen && tabVisible && allowMotion;
```

Three signals tracked separately, then combined:

- `onScreen` — IntersectionObserver, `threshold: 0`. Not a percentage: a tall
  panel on a short viewport can never clear one.
- `tabVisible` — `visibilitychange`. Must set **both** directions. An earlier
  version only ever paused, so returning to the tab left the widget dead
  forever.
- `allowMotion` — `prefers-reduced-motion`, watched via `addEventListener`
  on the media query, not read once.

Server-rendered first paint uses a fixed `SEED` array so hydration matches.
Randomisation only starts in `useEffect`.

`Reveal.tsx` **fails open**: the `.reveal` class is added by JS, so if JS
never runs, content stays visible. Never invert that.

## The qualifier

`Qualifier.tsx` replaces the contact form. It's a branching conversation:
side → verticals → volume → timeline → contact details.

It reflects real data back at the user — picking a vertical surfaces that
vertical's actual qualifying note from `content.ts`. On the publisher path
it reads `PUBLISHER_OPEN` and **tells the user plainly** when a vertical they
picked isn't open to publisher traffic. Keep that honesty; don't soften it
into a generic confirmation.

Contact details are the last step, never the first.

## Directions already tried and rejected

Don't reach for these again — they were built and removed after review:

- Dark maximalist "awwwards" treatment: Fraunces display serif, gradient
  text, grain + vignette, rotating rings.
- Preloader with a fake progress counter.
- Custom cursor (dot + lagging ring).
- Magnetic buttons.
- Per-character headline animation.
- 400vh scroll-hijacked horizontal card section.
- Marquee tickers.
- `motion` / framer-motion — removed as a dependency. Animation is CSS plus
  IntersectionObserver. Don't add it back for scroll reveals.

The feedback that drove each removal: it read as generic AI output, it wasn't
professional, and decoration was standing in for substance.

## Open gaps

- **Logo** — nav and footer use a placeholder `TBW` block (`Wordmark` in
  `Nav.tsx`). Drop the real file in `public/` and swap for `next/image`.
- **No form endpoint** — `Qualifier.tsx` collects answers into one object and
  stops. The success screen says so explicitly. Wire to the CRM.
- **Compliance specifics** — certification provider (TrustedForm / Jornaya),
  retention policy, DNC handling. Placeholder in `Compliance.tsx`.
- **Case studies** — placeholder in `Compliance.tsx`.
- **Two FAQ answers** are `null` pending real payout terms and the CRM
  integration list.
- Social links in the footer are `#`.
