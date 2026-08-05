import Reveal from "./Reveal";
import { SERVICES } from "@/lib/content";

export default function Services() {
  return (
    <section id="services" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,80px)] gut">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <p className="section-label">Agency services</p>
            <h2 className="h2 mt-3 max-w-[22ch]">Work we take on outside lead generation</h2>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="max-w-[42ch] text-[14px] leading-relaxed text-body">
              Retained or project-based, for clients who want the media managed rather than
              the leads bought.
            </p>
          </Reveal>
        </div>

        <ul className="mt-9 grid gap-x-12 md:grid-cols-2">
          {SERVICES.map((s, i) => (
            <Reveal as="li" key={s.name} delay={0.2 + (i % 2) * 0.1 + Math.floor(i / 2) * 0.08}>
              <div className="flex gap-5 border-b border-line py-5">
                <span className="mono-label pt-0.5 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="h3">{s.name}</h3>
                  <p className="mt-1 text-[14px] leading-relaxed text-body">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
