import { ArrowRight } from "lucide-react";
import Reveal from "./Reveal";
import { ADVERTISER_STEPS, PUBLISHER_STEPS } from "@/lib/content";

type Step = { n: string; title: string; body: string };

function Track({
  id,
  label,
  heading,
  intro,
  steps,
  cta,
  variant,
}: {
  id: string;
  label: string;
  heading: string;
  intro: string;
  steps: Step[];
  cta: string;
  variant: "primary" | "secondary";
}) {
  return (
    <div id={id} className="scroll-mt-16 bg-paper px-[var(--gut)] py-[clamp(40px,5vw,64px)] md:px-10">
      <Reveal>
        <p className="section-label">{label}</p>
        <h2 className="h2 mt-3">{heading}</h2>
        <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-body">{intro}</p>
      </Reveal>

      <ol className="mt-8">
        {steps.map((s, i) => (
          <Reveal as="li" key={s.n} delay={0.15 + i * 0.1}>
            <div className="flex gap-4 border-t border-line py-4">
              <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full border border-line-strong font-mono text-[11px]">
                {s.n}
              </span>
              <div>
                <h3 className="h3">{s.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-body">{s.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.5}>
        <a
          href={variant === "secondary" ? "https://portal.grovlabs.com" : "#contact"}
          className={`btn mt-7 ${variant === "secondary" ? "btn-secondary" : ""}`}
        >
          {cta}
          <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </Reveal>
    </div>
  );
}

export default function Audiences() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto grid max-w-[1240px] gap-px bg-line md:grid-cols-2">
        <Track
          id="advertisers"
          label="For advertisers"
          heading="Buying leads"
          intro="We manage the media, creative and quality controls, then post qualified leads straight into your CRM or dialer. Terms are agreed per vertical before any volume runs."
          steps={ADVERTISER_STEPS}
          cta="Request a rate card"
          variant="primary"
        />
        <Track
          id="publishers"
          label="For publishers"
          heading="Sending traffic"
          intro="We are onboarding publishers for SSDI CPA, ACA CPA/CPL and FE CPL campaigns. Every partner gets a named account manager and access to real-time reporting."
          steps={PUBLISHER_STEPS}
          cta="Apply as a publisher"
          variant="secondary"
        />
      </div>
    </section>
  );
}
