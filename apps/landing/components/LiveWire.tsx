"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Full-bleed live strip for the hero.
 *
 * Leads arrive, the counter climbs, the sparkline fills. Values are
 * illustrative and captioned as such — it demonstrates the real-time
 * posting the company sells, it is not a performance claim.
 *
 * Pauses off-screen, pauses on tab-hide, resumes on return, and renders
 * completely static under prefers-reduced-motion.
 */

const CODES = ["ACA", "MVA", "SSDI", "FE", "MED", "U65", "DV", "DEBT"];
const STATES = ["TX", "FL", "OH", "AZ", "PA", "NV", "GA", "NC", "MI", "TN", "IN", "CA"];

type Post = { id: number; code: string; state: string; ok: boolean };

const SEED: Post[] = [
  { id: 0, code: "ACA", state: "TX", ok: true },
  { id: 1, code: "MVA", state: "FL", ok: true },
  { id: 2, code: "SSDI", state: "OH", ok: false },
  { id: 3, code: "FE", state: "AZ", ok: true },
  { id: 4, code: "MED", state: "PA", ok: true },
  { id: 5, code: "U65", state: "NV", ok: true },
  { id: 6, code: "DV", state: "GA", ok: true },
];

const SEED_SPARK = [34, 41, 38, 52, 61, 58, 72, 80, 76, 88, 84, 93, 89, 96];

export default function LiveWire({ audience }: { audience: "advertiser" | "publisher" }) {
  const [posts, setPosts] = useState<Post[]>(SEED);
  const [count, setCount] = useState(1284);
  const [spark, setSpark] = useState(SEED_SPARK);

  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [allowMotion, setAllowMotion] = useState(false);

  const wrap = useRef<HTMLDivElement>(null);
  const nextId = useRef(SEED.length);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setAllowMotion(!mq.matches);
    applyMotion();
    mq.addEventListener("change", applyMotion);

    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0 });
    io.observe(el);

    const onVis = () => setTabVisible(!document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      mq.removeEventListener("change", applyMotion);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const live = onScreen && tabVisible && allowMotion;

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => {
      const ok = Math.random() > 0.14;
      setPosts((prev) => [
        {
          id: nextId.current++,
          code: CODES[Math.floor(Math.random() * CODES.length)],
          state: STATES[Math.floor(Math.random() * STATES.length)],
          ok,
        },
        ...prev,
      ].slice(0, 7));
      setCount((n) => n + 1);
      setSpark((prev) => [...prev.slice(1), Math.max(28, Math.min(100, prev[prev.length - 1] + (Math.random() * 22 - 10)))]);
    }, 1750);
    return () => clearInterval(t);
  }, [live]);

  const peak = Math.max(...spark);

  return (
    <div ref={wrap} className="band border-y border-espresso-line">
      <div className="mx-auto max-w-[1240px] gut">
        <div className="grid items-center gap-8 py-7 lg:grid-cols-[auto_1fr_auto] lg:gap-12">
          {/* counter */}
          <div className="flex items-center gap-5">
            <span className="relative flex h-2.5 w-2.5 flex-none" aria-hidden="true">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ec27d] opacity-75" />
              )}
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#4ec27d]" />
            </span>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#94826f]">
                {audience === "publisher" ? "Posts accepted today" : "Leads posted today"}
              </p>
              <p className="mt-1 font-mono text-[clamp(34px,4.4vw,54px)] font-medium leading-none tracking-[-0.02em] tabular-nums text-[#f6f1ea]">
                {count.toLocaleString("en-US")}
              </p>
            </div>
          </div>

          {/* stream */}
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#94826f]">
              Arriving now
            </p>
            <ul className="mt-2.5 flex gap-2 overflow-hidden" aria-hidden="true">
              {posts.map((p, i) => (
                <li
                  key={p.id}
                  className="flex flex-none items-center gap-2 rounded-[4px] border px-2.5 py-1.5 font-mono text-[11px]"
                  style={{
                    borderColor: p.ok ? "#3d5d45" : "#5d4331",
                    background: p.ok ? "rgba(78,194,125,0.07)" : "rgba(214,154,106,0.07)",
                    color: p.ok ? "#8fd3a8" : "#d69a6a",
                    opacity: 1 - i * 0.11,
                    animation: i === 0 ? "wireIn 0.5s cubic-bezier(0.19,1,0.22,1)" : undefined,
                  }}
                >
                  <span className="font-medium">{p.code}</span>
                  <span className="text-[#7b6a58]">{p.state}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* sparkline */}
          <div className="hidden xl:block">
            <p className="text-right font-mono text-[10px] uppercase tracking-[0.16em] text-[#94826f]">
              Last 14 min
            </p>
            <div className="mt-2.5 flex h-[42px] w-[190px] items-end gap-[3px]" aria-hidden="true">
              {spark.map((v, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-t-[2px] transition-[height] duration-500 ease-out"
                  style={{
                    height: `${(v / peak) * 100}%`,
                    background: i === spark.length - 1 ? "#d69a6a" : "#4a3627",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="pb-4 font-mono text-[10px] text-[#7b6a58]">
          Interface preview — sample values, not reported performance.
        </p>
      </div>
    </div>
  );
}
