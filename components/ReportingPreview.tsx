"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Live preview of the partner reporting dashboard.
 *
 * The product is real-time posting, so this actually runs: leads arrive,
 * counters move, the chart fills. Values are illustrative and captioned as
 * such — this demonstrates the interface, it does not report performance.
 *
 * Only animates while on screen, pauses when the tab is hidden, and renders
 * static under prefers-reduced-motion.
 */

const CODES = ["ACA", "MVA", "SSDI", "FE", "MED", "U65", "DV", "DEBT"];
const STATES = ["TX", "FL", "OH", "AZ", "PA", "NV", "GA", "NC", "MI", "TN"];

type Row = { id: number; time: string; code: string; state: string; status: string };

const STATUS_STYLE: Record<string, string> = {
  Accepted: "bg-[#eef6f0] text-[#2f6b41] border-[#b6d4bd]",
  Duplicate: "bg-[#fbf3e6] text-[#8a5f16] border-[#e4cfae]",
  Filter: "bg-[#f8eeea] text-[#9b3f2c] border-[#e3c3b8]",
};

/** Deterministic seed so server and client first paint match exactly. */
const SEED: Row[] = [
  { id: 0, time: "14:22:07", code: "ACA", state: "TX", status: "Accepted" },
  { id: 1, time: "14:21:52", code: "MVA", state: "FL", status: "Accepted" },
  { id: 2, time: "14:21:38", code: "SSDI", state: "OH", status: "Duplicate" },
  { id: 3, time: "14:21:11", code: "FE", state: "AZ", status: "Accepted" },
  { id: 4, time: "14:20:46", code: "MED", state: "PA", status: "Accepted" },
  { id: 5, time: "14:20:19", code: "DEBT", state: "NV", status: "Filter" },
];

const BASE_BARS = [18, 26, 34, 47, 63, 71, 88, 96, 84, 77, 69, 58, 41, 29];

function clockNow() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

export default function ReportingPreview() {
  const [rows, setRows] = useState<Row[]>(SEED);
  const [leads, setLeads] = useState(1284);
  const [accepted, setAccepted] = useState(1131);
  const [rejected, setRejected] = useState(153);
  const [bars, setBars] = useState(BASE_BARS);

  // Tracked separately, then combined — so returning to the tab resumes
  // the feed instead of leaving it permanently stopped.
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [allowMotion, setAllowMotion] = useState(false);

  const wrap = useRef<HTMLElement>(null);
  const nextId = useRef(SEED.length);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotion = () => setAllowMotion(!mq.matches);
    applyMotion();
    mq.addEventListener("change", applyMotion);

    // threshold 0: any sliver on screen counts. A tall panel on a short
    // viewport can otherwise never clear a percentage-based threshold.
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      threshold: 0,
    });
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

  const running = onScreen && tabVisible && allowMotion;

  useEffect(() => {
    if (!running) return;

    const tick = setInterval(() => {
      const roll = Math.random();
      const status = roll > 0.88 ? "Duplicate" : roll > 0.8 ? "Filter" : "Accepted";

      const row: Row = {
        id: nextId.current++,
        time: clockNow(),
        code: CODES[Math.floor(Math.random() * CODES.length)],
        state: STATES[Math.floor(Math.random() * STATES.length)],
        status,
      };

      setRows((prev) => [row, ...prev].slice(0, 6));
      setLeads((n) => n + 1);
      if (status === "Accepted") setAccepted((n) => n + 1);
      else setRejected((n) => n + 1);

      setBars((prev) => {
        const next = [...prev];
        next[next.length - 1] = Math.min(100, next[next.length - 1] + Math.random() * 4);
        return next;
      });
    }, 2100);

    return () => clearInterval(tick);
  }, [running]);

  const peak = Math.max(...bars);
  const rate = ((accepted / leads) * 100).toFixed(1);

  const kpis = [
    { label: "Leads today", value: leads.toLocaleString("en-US"), delta: "+6.2%", up: true },
    { label: "Accepted", value: accepted.toLocaleString("en-US"), delta: "+7.4%", up: true },
    { label: "Rejected", value: rejected.toLocaleString("en-US"), delta: "−2.1%", up: false },
    { label: "Accept rate", value: `${rate}%`, delta: "+1.3pt", up: true },
  ];

  return (
    <figure ref={wrap} className="m-0">
      <div className="card card-raised overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-paper px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2f9e5e] opacity-70" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2f9e5e]" />
            </span>
            <span className="font-mono text-[11px] font-medium">Partner dashboard</span>
            <span className="font-mono text-[10px] text-muted">
              {running ? "live" : "paused"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-[3px] border border-line-strong px-2 py-0.5 font-mono text-[10px] text-muted">
              Today
            </span>
            <span className="rounded-[3px] border border-line-strong px-2 py-0.5 font-mono text-[10px] text-muted">
              All verticals
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="bg-surface px-4 py-3.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
                {k.label}
              </p>
              <p className="mt-1.5 font-mono text-[20px] font-medium tabular-nums">{k.value}</p>
              <p
                className={`mt-0.5 font-mono text-[10px] ${
                  k.up ? "text-[#2f6b41]" : "text-[#9b3f2c]"
                }`}
              >
                {k.delta}
              </p>
            </div>
          ))}
        </div>

        <div className="border-b border-line px-4 py-4">
          <div className="flex items-baseline justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
              Volume by hour
            </p>
            <p className="font-mono text-[10px] text-muted">06:00 — now</p>
          </div>
          <div className="mt-3 flex h-[92px] items-end gap-[3px]" aria-hidden="true">
            {bars.map((b, i) => (
              <div
                key={i}
                className={`flex-1 rounded-t-[2px] transition-[height] duration-700 ease-out ${
                  i === bars.length - 1 ? "bg-copper" : b === peak ? "bg-copper/70" : "bg-[#e0cdbd]"
                }`}
                style={{ height: `${(b / peak) * 100}%` }}
              />
            ))}
          </div>
        </div>

        <div className="px-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-muted">
            Recent posts
          </p>
          <table className="mt-2.5 w-full">
            <tbody>
              {rows.map((f, i) => (
                <tr
                  key={f.id}
                  className="border-b border-line last:border-b-0"
                  style={
                    i === 0
                      ? { animation: "rowIn 0.45s cubic-bezier(0.19,1,0.22,1)" }
                      : undefined
                  }
                >
                  <td className="py-2 font-mono text-[11px] tabular-nums text-muted">{f.time}</td>
                  <td className="py-2 font-mono text-[11px] font-medium text-copper">{f.code}</td>
                  <td className="py-2 font-mono text-[11px] text-body">{f.state}</td>
                  <td className="py-2 text-right">
                    <span
                      className={`inline-block rounded-[3px] border px-2 py-0.5 font-mono text-[10px] ${STATUS_STYLE[f.status]}`}
                    >
                      {f.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <figcaption className="mt-2.5 font-mono text-[10.5px] text-muted">
        Interface preview — sample values, not reported performance.
      </figcaption>
    </figure>
  );
}
