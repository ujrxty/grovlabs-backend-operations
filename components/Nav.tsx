"use client";

import { useEffect, useState } from "react";
import { Menu, X, Phone, LogIn } from "lucide-react";
import { NAV, SITE } from "@/lib/content";

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || "/dashboard";

/** Placeholder wordmark. Drop the real logo in /public and swap for next/image. */
export function Wordmark() {
  return (
    <a href="#top" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-[3px] bg-ink font-mono text-[11px] font-medium text-paper">
        TBW
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em]">{SITE.name}</span>
    </a>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>("");

  useEffect(() => {
    document.documentElement.classList.toggle("is-locked", open);
  }, [open]);

  // Highlight whichever section the reader is actually in.
  useEffect(() => {
    const targets = NAV.map((n) => document.querySelector(n.href)).filter(
      (el): el is Element => Boolean(el)
    );
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (hit) setCurrent(`#${hit.target.id}`);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0.05, 0.25, 0.5] }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 py-3 gut">
        <Wordmark />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => {
            const on = current === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={on ? "true" : undefined}
                className={`relative rounded-[3px] px-3 py-2 text-[14px] transition-colors ${
                  on ? "text-ink" : "text-body hover:bg-surface hover:text-ink"
                }`}
              >
                {item.label}
                <span
                  className={`absolute inset-x-3 -bottom-px h-px origin-left bg-copper transition-transform duration-300 ${
                    on ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={SITE.phoneHref}
            className="flex items-center gap-2 font-mono text-[13px] text-body hover:text-ink"
          >
            <Phone size={14} strokeWidth={1.7} aria-hidden="true" />
            {SITE.phone}
          </a>
          <a
            href={DASHBOARD_URL}
            className="flex items-center gap-2 rounded-[3px] border border-line-strong px-4 py-2 text-[14px] font-medium text-body transition-colors hover:border-ink hover:text-ink"
          >
            <LogIn size={15} strokeWidth={1.8} aria-hidden="true" />
            Login
          </a>
          <a href="#contact" className="btn">
            Request a proposal
          </a>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="grid h-9 w-9 place-items-center rounded-[3px] border border-line-strong lg:hidden"
        >
          {open ? <X size={17} strokeWidth={1.7} /> : <Menu size={17} strokeWidth={1.7} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-line bg-paper lg:hidden">
          <nav className="mx-auto flex max-w-[1240px] flex-col py-2 gut">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-[15px]"
              >
                {item.label}
              </a>
            ))}
            <a href={SITE.phoneHref} className="py-3 font-mono text-[14px]">
              {SITE.phone}
            </a>
            <div className="flex gap-3 my-3">
              <a
                href={DASHBOARD_URL}
                className="btn btn-secondary flex-1 justify-center"
              >
                <LogIn size={15} strokeWidth={1.8} aria-hidden="true" />
                Login
              </a>
              <a href="#contact" onClick={() => setOpen(false)} className="btn flex-1 justify-center">
                Request a proposal
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
