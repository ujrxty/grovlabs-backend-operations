import { ChevronDown } from "lucide-react";
import Reveal from "./Reveal";
import { FAQ as ITEMS } from "@/lib/content";

/**
 * Native <details> — works without JS, keyboard accessible for free,
 * and the first item is open so the section never reads as a wall of bars.
 */
export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,80px)] gut">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <Reveal>
            <p className="section-label">FAQ</p>
            <h2 className="h2 mt-3">How the model works</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              Common questions from advertisers and publishers evaluating a lead
              partner for the first time.
            </p>
          </Reveal>

          <div className="border-t border-line">
            {ITEMS.map((item, i) => (
              <Reveal key={item.q} delay={0.1 + i * 0.08}>
                <details className="faq-item border-b border-line" open={i === 0}>
                  <summary className="flex items-center justify-between gap-6 py-4">
                    <h3 className="text-[16px] font-medium leading-snug">{item.q}</h3>
                    <ChevronDown
                      size={17}
                      strokeWidth={1.7}
                      aria-hidden="true"
                      className="chev flex-none text-muted"
                    />
                  </summary>
                  <div className="pb-5 pr-10">
                    {item.a ? (
                      <p className="text-[14.5px] leading-relaxed text-body">{item.a}</p>
                    ) : (
                      <div className="placeholder">
                        <span className="placeholder-tag">Needs your input</span>
                        <p className="mt-2.5 text-[14px] text-body">{item.todo}</p>
                      </div>
                    )}
                  </div>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
