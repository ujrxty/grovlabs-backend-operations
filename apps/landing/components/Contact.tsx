import { Phone, Mail, MapPin } from "lucide-react";
import Reveal from "./Reveal";
import Qualifier from "./Qualifier";
import { SITE } from "@/lib/content";

export default function Contact() {
  return (
    <section id="contact" className="scroll-mt-16 border-b border-line bg-surface">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,84px)] gut">
        <div className="grid gap-12 lg:grid-cols-[1fr_0.62fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="section-label">Get started</p>
              <h2 className="h2 mt-4 max-w-[18ch]">
                Four questions, then we&apos;ll know what to send you
              </h2>
              <p className="lead mt-5">
                Rather than a contact form that asks everyone the same thing, this works
                out what you need first — so the reply is the rate card, the campaign
                list or the proposal, not a discovery call.
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-8">
                <Qualifier />
              </div>
            </Reveal>
          </div>

          <div className="lg:pt-24">
            <Reveal delay={0.3}>
              <div className="card">
                <Row icon={Phone} label="Prefer to talk">
                  <a href={SITE.phoneHref} className="hover:text-copper">
                    {SITE.phone}
                  </a>
                </Row>
                <Row icon={Mail} label="Email">
                  <a href={`mailto:${SITE.email}`} className="hover:text-copper">
                    {SITE.email}
                  </a>
                </Row>
                <Row icon={MapPin} label={SITE.hq.label} lines={SITE.hq.lines}>
                  {SITE.hq.city}
                </Row>
                <Row icon={MapPin} label={SITE.west.label} lines={SITE.west.lines} last>
                  {SITE.west.city}
                </Row>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  icon: Icon,
  label,
  children,
  lines,
  last,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  lines?: string[];
  last?: boolean;
}) {
  return (
    <div className={`flex gap-4 p-5 ${last ? "" : "border-b border-line"}`}>
      <Icon size={17} strokeWidth={1.7} className="mt-0.5 flex-none text-copper" aria-hidden="true" />
      <div>
        <p className="mono-label">{label}</p>
        <p className="mt-1 text-[15px] font-medium">{children}</p>
        {lines && (
          <p className="mt-1 text-[14px] leading-relaxed text-body">
            {lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
