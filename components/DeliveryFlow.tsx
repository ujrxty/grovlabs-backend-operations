"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { DELIVERY_STEPS } from "@/lib/content";

const NODES = ["Traffic", "Consent", "Validation", "Post", "CRM"];

export default function DeliveryFlow() {
  const [active, setActive] = useState(0);
  const step = DELIVERY_STEPS[active];

  return (
    <section id="delivery" className="band scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,84px)] gut">
        <Reveal>
          <div className="max-w-[58ch]">
            <p className="section-label">How it works</p>
            <h2 className="h2 mt-4 text-[#f4efe9]">From click to CRM, in real time</h2>
            <p className="mt-4 text-[15px] leading-relaxed">
              Every lead follows the same five stages. Consent is captured at submission, not
              reconstructed afterwards, and validation happens before anything is billed.
            </p>
          </div>
        </Reveal>

        {/* Stage selector — the diagram is the control. */}
        <Reveal delay={0.2}>
          <div className="mt-10 overflow-x-auto pb-1">
            <div
              role="tablist"
              aria-label="Delivery pipeline stages"
              className="flex min-w-[680px] items-center"
            >
              {NODES.map((label, i) => {
                const on = i === active;
                const done = i < active;
                return (
                  <div key={label} className="flex flex-1 items-center last:flex-none">
                    <button
                      role="tab"
                      aria-selected={on}
                      onClick={() => setActive(i)}
                      onMouseEnter={() => setActive(i)}
                      className={`group flex flex-none flex-col items-center gap-2.5 transition-opacity ${
                        on ? "" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span
                        className={`grid h-[52px] w-[112px] place-items-center rounded-[5px] border font-mono text-[12px] transition-all duration-200 ${
                          on
                            ? "border-copper bg-copper text-white shadow-[0_6px_18px_-6px_rgba(166,90,46,0.8)]"
                            : i === 4
                              ? "border-dashed border-[#6b5744] bg-transparent text-[#d69a6a]"
                              : "border-[#3a2a1e] bg-[#241810] text-[#e8e0d6] group-hover:border-[#6b5744]"
                        }`}
                      >
                        {label}
                      </span>
                      <span
                        className={`font-mono text-[10px] ${on ? "text-copper" : "text-[#7b6a58]"}`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </button>

                    {i < NODES.length - 1 && (
                      <span className="mx-2 h-px flex-1 bg-[#3a2a1e]">
                        <span
                          className={`block h-px origin-left bg-copper transition-transform duration-500 ${
                            done || on ? "scale-x-100" : "scale-x-0"
                          }`}
                        />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        {/* Detail panel driven by the selection. */}
        <Reveal delay={0.35}>
          <div
            role="tabpanel"
            className="mt-8 grid gap-6 rounded-[6px] border border-espresso-line bg-[#241810] p-6 md:grid-cols-[auto_1fr] md:items-start md:gap-10"
          >
            <span className="font-mono text-[42px] leading-none text-copper">{step.n}</span>
            <div>
              <h3 className="text-[19px] font-semibold text-[#f4efe9]">{step.title}</h3>
              <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed">{step.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {DELIVERY_STEPS.map((s, i) => (
                  <button
                    key={s.n}
                    onClick={() => setActive(i)}
                    aria-label={`Stage ${s.n}: ${s.title}`}
                    className={`h-1 w-10 rounded-full transition-colors ${
                      i === active ? "bg-copper" : "bg-[#3a2a1e] hover:bg-[#6b5744]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
