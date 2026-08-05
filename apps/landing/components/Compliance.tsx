import { ShieldCheck, FileCheck2, ListFilter, Database } from "lucide-react";
import Placeholder from "./Placeholder";
import Reveal from "./Reveal";
import { UNVERIFIED_CLAIMS, CLAIMED_PARTNERSHIPS } from "@/lib/content";

/** standard — true of any compliant operator; the specifics are marked below. */
const CONTROLS = [
  {
    icon: ShieldCheck,
    title: "Prior express written consent",
    body: "Consent language naming the contacting parties is presented at the form, and the agreement is stored with the record.",
  },
  {
    icon: FileCheck2,
    title: "Session certification",
    body: "An independent third-party certificate evidences what the consumer saw and agreed to, timestamped at submission.",
  },
  {
    icon: ListFilter,
    title: "Pre-delivery scrubbing",
    body: "Records are screened for duplicates, invalid contact data and DNC status before they are released or billed.",
  },
  {
    icon: Database,
    title: "Retention & audit trail",
    body: "Lead records and their consent artefacts are retained so any later complaint can be answered with evidence.",
  },
];

export default function Compliance() {
  return (
    <section id="compliance" className="scroll-mt-16 border-b border-line bg-surface">
      <div className="mx-auto max-w-[1240px] py-[clamp(48px,6vw,80px)] gut">
        <Reveal>
          <div className="max-w-[62ch]">
            <p className="section-label">Compliance</p>
            <h2 className="h2 mt-3">Consent is the product</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-body">
              In regulated verticals the liability sits with whoever makes the call. A lead
              without a defensible consent record is a liability transfer, not an asset — so
              these four controls sit around every campaign.
            </p>
          </div>
        </Reveal>

        <div className="mt-9 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {CONTROLS.map((c, i) => (
            <Reveal key={c.title} delay={0.15 + i * 0.1} className="bg-surface p-6">
              <c.icon size={20} strokeWidth={1.6} className="text-copper" aria-hidden="true" />
              <h3 className="h3 mt-4">{c.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-body">{c.body}</p>
            </Reveal>
          ))}
        </div>

        {/* The two gaps that actually block a partner signing. */}
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Placeholder
            title="Your certification stack"
            needs={[
              "Certification provider — TrustedForm, Jornaya or equivalent",
              "Whether certificates are passed with every lead",
              "Data retention period and DNC handling process",
            ]}
          />
          <Placeholder
            title="Case studies"
            needs={[
              "Client or vertical (anonymised is fine — 'a top-5 ACA carrier')",
              "Cost per lead before and after, with the date range",
              "Volume delivered and total spend",
            ]}
          />
        </div>

        <details className="mt-6 border border-line bg-paper p-6">
          <summary className="cursor-pointer text-[15px] font-medium">
            Claims carried over from the current site — unverified
          </summary>
          <p className="mt-3 max-w-[70ch] text-[14px] leading-relaxed text-body">
            These appear on thebrokenwood.com today with no source attached. They are held
            here rather than shown as headline figures. Substantiate or remove before launch.
          </p>

          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            {UNVERIFIED_CLAIMS.map((c) => (
              <div key={c.label} className="border-l-2 border-line-strong pl-4">
                <dt className="mono-label">{c.label}</dt>
                <dd className="mt-1 text-[17px] font-medium">
                  {c.value}
                  <span className="ml-2 align-middle font-mono text-[10px] uppercase tracking-[0.08em] text-copper">
                    Unverified
                  </span>
                </dd>
                <p className="mt-1 text-[13px] text-muted">{c.note}</p>
              </div>
            ))}
          </dl>

          <div className="mt-6 border-t border-line pt-5">
            <p className="mono-label">Asserted partnerships &amp; certifications</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {CLAIMED_PARTNERSHIPS.map((p) => (
                <li key={p} className="pill">{p}</li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] text-muted">
              Shown as text pending official brand assets. Most of these programmes require an
              active partner ID and grant permission to display the badge.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
