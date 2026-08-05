"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import Reveal from "./Reveal";
import { VERTICALS, type Vertical } from "@/lib/content";

const STATUS_CLASS: Record<Vertical["status"], string> = {
  Live: "pill pill-live",
  Onboarding: "pill pill-onboarding",
  Seasonal: "pill pill-seasonal",
};

const MODELS = ["CPA", "CPL"] as const;
const STATUSES = ["Live", "Onboarding", "Seasonal"] as const;

export default function VerticalsTable() {
  const [models, setModels] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const rows = useMemo(
    () =>
      VERTICALS.filter((v) => {
        const modelOk = models.length === 0 || models.some((m) => v.model.includes(m));
        const statusOk = statuses.length === 0 || statuses.includes(v.status);
        return modelOk && statusOk;
      }),
    [models, statuses]
  );

  const filtered = models.length > 0 || statuses.length > 0;

  return (
    <section id="verticals" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,84px)] gut">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="section-label">Campaign inventory</p>
            <h2 className="h2 mt-4 max-w-[16ch]">Eight verticals, all US nationwide</h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="max-w-[42ch] text-[14px] leading-relaxed text-body">
              Payouts and daily caps are set per partner and quoted on the current rate card.
              Filter criteria are agreed in writing before volume runs.
            </p>
          </Reveal>
        </div>

        {/* Filters */}
        <Reveal delay={0.25}>
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <span className="mono-label mr-1">Model</span>
            {MODELS.map((m) => (
              <button
                key={m}
                type="button"
                className="chip"
                aria-pressed={models.includes(m)}
                onClick={() => toggle(models, setModels, m)}
              >
                {m}
              </button>
            ))}

            <span className="mono-label ml-4 mr-1">Status</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className="chip"
                aria-pressed={statuses.includes(s)}
                onClick={() => toggle(statuses, setStatuses, s)}
              >
                {s}
              </button>
            ))}

            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setModels([]);
                  setStatuses([]);
                }}
                className="ml-2 inline-flex items-center gap-1.5 font-mono text-[11px] text-copper hover:text-copper-deep"
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
                Clear
              </button>
            )}

            <span className="ml-auto font-mono text-[11px] tabular-nums text-muted" aria-live="polite">
              {rows.length} of {VERTICALS.length} shown
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.35}>
          <div className="mt-4 overflow-x-auto border border-line bg-paper">
            <table className="data-table min-w-[900px]">
              <caption className="sr-only">
                Lead generation campaigns by vertical, pricing model, geography, delivery
                method, qualifying notes and current status
              </caption>
              <thead>
                <tr>
                  <th scope="col">Code</th>
                  <th scope="col">Vertical</th>
                  <th scope="col">Model</th>
                  <th scope="col">Geo</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">Qualifying notes</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.code}>
                    <td className="num font-medium text-copper">{v.code}</td>
                    <td className="whitespace-nowrap font-medium">{v.name}</td>
                    <td className="num whitespace-nowrap">{v.model}</td>
                    <td className="num">{v.geo}</td>
                    <td className="whitespace-nowrap text-body">{v.delivery}</td>
                    <td className="max-w-[320px] text-[13.5px] leading-snug text-body">{v.note}</td>
                    <td>
                      <span className={STATUS_CLASS[v.status]}>{v.status}</span>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[14px] text-muted">
                      No campaigns match those filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.45}>
          <div className="mt-6 flex flex-wrap items-center gap-x-10 gap-y-4 border border-line bg-surface p-5">
            <div>
              <p className="mono-label">Payout &amp; caps</p>
              <p className="mt-1 text-[14px]">Quoted per partner on the current rate card</p>
            </div>
            <div>
              <p className="mono-label">Pricing models</p>
              <p className="mt-1 text-[14px]">CPA and CPL</p>
            </div>
            <div>
              <p className="mono-label">Coverage</p>
              <p className="mt-1 text-[14px]">United States, nationwide</p>
            </div>
            <a href="#contact" className="btn ml-auto">
              Request the rate card
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
