"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import LiveWire from "./LiveWire";
import GradientMesh from "./GradientMesh";
import { VERTICALS, PUBLISHER_OPEN, SITE } from "@/lib/content";

type Audience = "advertiser" | "publisher";

// Animated counter hook - slow and elegant
function useCounter(end: number, duration = 1800, start = 0, trigger = true) {
  const [count, setCount] = useState(start);

  useEffect(() => {
    if (!trigger) return;
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Smoother ease-out quart for luxurious feel
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(start + (end - start) * eased));
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start, trigger]);

  return count;
}

// Animated stat component
function AnimatedStat({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  // Parse numeric values for counter animation
  const numericMatch = value.match(/^(\d+)(\/(\d+))?$/);
  const isNumeric = numericMatch && !value.includes("·");

  const firstNum = useCounter(
    numericMatch ? parseInt(numericMatch[1]) : 0,
    1600,
    0,
    visible && !!numericMatch
  );
  const secondNum = useCounter(
    numericMatch?.[3] ? parseInt(numericMatch[3]) : 0,
    1600,
    0,
    visible && !!numericMatch?.[3]
  );

  const displayValue = isNumeric
    ? numericMatch[3] ? `${firstNum}/${secondNum}` : String(firstNum)
    : value;

  return (
    <div
      ref={ref}
      className="stat-reveal"
      style={{
        animationDelay: `${delay}ms`,
        opacity: 0,
      }}
    >
      <dd className="figure-xl">{displayValue}</dd>
      <dt className="mono-label mt-2.5">{label}</dt>
    </div>
  );
}

const COPY: Record<
  Audience,
  {
    lines: string[];
    highlight: string;
    lead: string;
    cta: { label: string; href: string };
    alt: { label: string; href: string };
    figures: { value: string; label: string }[];
  }
> = {
  advertiser: {
    lines: ["Qualified leads,", "priced and delivered", "in real time."],
    highlight: "priced and delivered",
    lead: "We run the media, screen the record, and post it into your CRM the moment it converts — on CPA or CPL terms agreed before any volume runs.",
    cta: { label: "Get the rate card", href: "#contact" },
    alt: { label: "See the inventory", href: "#verticals" },
    figures: [
      { value: String(VERTICALS.length), label: "Verticals" },
      { value: `${VERTICALS.filter((v) => v.status !== "Onboarding").length}/${VERTICALS.length}`, label: "Running now" },
      { value: "US", label: "Coverage" },
      { value: "CPA · CPL", label: "Pricing" },
    ],
  },
  publisher: {
    lines: ["Your traffic,", "on open campaigns", "that pay on time."],
    highlight: "on open campaigns",
    lead: "We're onboarding publishers for SSDI, ACA and Final Expense. Named account manager, real-time tracking, and terms agreed before you send a single click.",
    cta: { label: "Apply to send traffic", href: "#contact" },
    alt: { label: "See open campaigns", href: "#verticals" },
    figures: [
      { value: String(PUBLISHER_OPEN.length), label: "Open to publishers" },
      { value: "CPA · CPL", label: "Models" },
      { value: "US", label: "Coverage" },
      { value: "Real-time", label: "Tracking" },
    ],
  },
};

export default function Hero() {
  const [audience, setAudience] = useState<Audience>("advertiser");
  const [animKey, setAnimKey] = useState(0);
  const c = COPY[audience];

  // Reset animations when audience changes
  const handleAudienceChange = (newAudience: Audience) => {
    setAudience(newAudience);
    setAnimKey((k) => k + 1);
  };

  return (
    <section id="top" className="border-b border-line">
      <div className="relative overflow-hidden">
        <GradientMesh />

        {/* Grid pattern */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage: "linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
            backgroundSize: "calc(100% / 12) 100%",
            maskImage: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent 82%)",
            WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent 82%)",
          }}
        />

        <div className="relative mx-auto max-w-[1240px] pb-[clamp(38px,4.5vw,60px)] pt-[clamp(44px,5.5vw,76px)] gut">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <p className="section-label text-reveal" style={{ animationDelay: "100ms" }}>
              {SITE.descriptor}
            </p>

            <div className="flex items-center gap-3">
              <span className="hidden font-mono text-[10.5px] uppercase tracking-[0.13em] text-muted sm:inline">
                I&apos;m here to
              </span>
              <div className="switch" role="group" aria-label="Choose what you're here for">
                <button
                  type="button"
                  aria-pressed={audience === "advertiser"}
                  onClick={() => handleAudienceChange("advertiser")}
                >
                  Buy leads
                </button>
                <button
                  type="button"
                  aria-pressed={audience === "publisher"}
                  onClick={() => handleAudienceChange("publisher")}
                >
                  Send traffic
                </button>
              </div>
            </div>
          </div>

          {/* Headline with line-by-line stagger */}
          <h1 key={`h-${audience}-${animKey}`} className="h1 mt-7 max-w-[15ch]">
            {c.lines.map((line, i) => (
              <span
                key={i}
                className={`block line-reveal ${line === c.highlight ? "text-copper highlight-sweep" : ""}`}
                style={{ animationDelay: `${200 + i * 200}ms` }}
              >
                {line}
              </span>
            ))}
          </h1>

          <div className="mt-8 grid gap-x-16 gap-y-7 lg:grid-cols-[1fr_auto] lg:items-end">
            {/* Lead text with reveal */}
            <p
              key={`l-${audience}-${animKey}`}
              className="lead text-reveal"
              style={{ animationDelay: "900ms" }}
            >
              {c.lead}
            </p>

            {/* CTAs with stagger */}
            <div className="flex flex-wrap gap-3">
              <a
                href={c.cta.href}
                className="btn btn-reveal"
                style={{ animationDelay: "1200ms" }}
              >
                {c.cta.label}
                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
              </a>
              <a
                href={c.alt.href}
                className="btn btn-secondary btn-reveal"
                style={{ animationDelay: "1400ms" }}
              >
                {c.alt.label}
              </a>
            </div>
          </div>

          {/* Stats with counter animation */}
          <dl
            key={`f-${audience}-${animKey}`}
            className="mt-11 grid grid-cols-2 border-t border-line-strong pt-7 md:grid-cols-4"
          >
            {c.figures.map((f, i) => (
              <div
                key={f.label}
                className={`pr-6 ${i === c.figures.length - 1 ? "" : "border-r border-line md:pr-8"}`}
              >
                <AnimatedStat value={f.value} label={f.label} delay={1600 + i * 150} />
              </div>
            ))}
          </dl>
        </div>
      </div>

      <LiveWire audience={audience} />
    </section>
  );
}
