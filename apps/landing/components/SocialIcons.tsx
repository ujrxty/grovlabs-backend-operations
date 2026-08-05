/**
 * Lucide v1 dropped brand glyphs, so these three are hand-rolled to match
 * its drawing conventions: 24x24 box, currentColor stroke, 1.75 width.
 */
type Props = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function FacebookIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M17 3h-2.5A4.5 4.5 0 0 0 10 7.5V10H7.5v4H10v7h4v-7h2.5l.5-4H14V7.5a.5.5 0 0 1 .5-.5H17z" />
    </svg>
  );
}

export function LinkedinIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" rx="1" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

export function InstagramIcon({ className }: Props) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" />
    </svg>
  );
}
