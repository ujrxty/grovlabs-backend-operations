import Reveal from "./Reveal";
import ReportingPreview from "./ReportingPreview";

export default function Reporting() {
  return (
    <section id="reporting" className="scroll-mt-16 border-b border-line">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,84px)] gut">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:pt-4">
            <Reveal>
              <p className="section-label">Reporting</p>
              <h2 className="h2 mt-4 max-w-[16ch]">You see what we see</h2>
              <p className="lead mt-5">
                Every partner gets a live view of what has been posted, what was accepted and
                what was rejected — with the reason attached. No end-of-month spreadsheet,
                no waiting on an account manager to pull a report.
              </p>
            </Reveal>

            <dl className="mt-8 border-t border-line">
              {[
                { t: "Per-lead status", d: "Accepted, duplicate or filtered, with the rejection reason." },
                { t: "Volume by hour", d: "Where the day is pacing against your cap." },
                { t: "Accept rate", d: "Tracked continuously so quality issues surface early." },
              ].map((row, i) => (
                <Reveal key={row.t} delay={0.15 + i * 0.1}>
                  <div className="border-b border-line py-3.5">
                    <dt className="h3">{row.t}</dt>
                    <dd className="mt-0.5 text-[14px] leading-relaxed text-body">{row.d}</dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </div>

          <Reveal delay={0.25}>
            <ReportingPreview />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
