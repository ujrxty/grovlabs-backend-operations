"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, AlertCircle } from "lucide-react";
import { VERTICALS, PUBLISHER_OPEN, TRAFFIC_SOURCES, SERVICES, SITE } from "@/lib/content";

/**
 * A qualification conversation rather than a form.
 *
 * It asks one thing at a time, reflects back what it just heard using real
 * campaign detail, branches on the answers, and tells the user honestly when
 * something they picked isn't available. The final step is the only place it
 * asks for contact details — by then it has earned them.
 */

type Side = "advertiser" | "publisher" | "agency";

type Answers = {
  side: Side | null;
  verticals: string[];
  services: string[];
  sources: string[];
  volume: string;
  timeline: string;
};

const EMPTY: Answers = {
  side: null,
  verticals: [],
  services: [],
  sources: [],
  volume: "",
  timeline: "",
};

const SIDES: { id: Side; label: string; sub: string }[] = [
  { id: "advertiser", label: "I want to buy leads", sub: "You have agents or a sales floor to feed." },
  { id: "publisher", label: "I have traffic to send", sub: "You run media and want to monetise it." },
  { id: "agency", label: "I need marketing done", sub: "You want the media managed for you." },
];

const VOLUMES_ADV = ["Under 50 / day", "50–250 / day", "250–1,000 / day", "1,000+ / day"];
const VOLUMES_PUB = ["Under 1k / month", "1k–10k / month", "10k–50k / month", "50k+ / month"];
const TIMELINES = ["Right away", "Within 30 days", "This quarter", "Just researching"];

export default function Qualifier() {
  const [step, setStep] = useState(0);
  const [a, setA] = useState<Answers>(EMPTY);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = useState("");

  // Steps depend on which side they said they were on.
  const flow: string[] =
    a.side === "agency"
      ? ["side", "services", "timeline", "details"]
      : a.side
        ? ["side", "verticals", "volume", "timeline", "details"]
        : ["side"];

  const key = flow[step];
  const isLast = key === "details";

  const toggle = (field: "verticals" | "services" | "sources", value: string) =>
    setA((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));

  const next = () => setStep((s) => Math.min(s + 1, flow.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  // Move focus to the new question so keyboard and screen-reader users
  // follow the conversation rather than losing their place.
  useEffect(() => {
    if (step > 0) panelRef.current?.focus();
  }, [step]);

  const canAdvance =
    key === "side" ? Boolean(a.side)
    : key === "verticals" ? a.verticals.length > 0
    : key === "services" ? a.services.length > 0
    : key === "volume" ? Boolean(a.volume)
    : key === "timeline" ? Boolean(a.timeline)
    : true;

  /** What the site says back, built from what it actually knows. */
  const reply = (): { text: string; warn?: string } | null => {
    if (step === 0) return null;

    if (key === "verticals" && a.side) {
      return { text: a.side === "advertiser" ? "Buying, then. Which ones?" : "Good. What can you run?" };
    }
    if (key === "services") return { text: "Understood — you want it managed rather than bought." };

    if (key === "volume") {
      const picked = VERTICALS.filter((v) => a.verticals.includes(v.code));
      const closed = a.side === "publisher"
        ? a.verticals.filter((c) => !PUBLISHER_OPEN.includes(c))
        : [];
      const note = picked[0]?.note;
      return {
        text: picked.length === 1
          ? `${picked[0].name}. ${note}`
          : `${picked.length} verticals. Worth knowing: ${note}`,
        warn: closed.length
          ? `${closed.join(", ")} ${closed.length === 1 ? "isn't" : "aren't"} open to publisher traffic right now — the open campaigns are ${PUBLISHER_OPEN.join(", ")}. We can still talk about the rest.`
          : undefined,
      };
    }
    if (key === "timeline") return { text: `${a.volume}. Noted.` };
    if (key === "details") {
      return {
        text: a.timeline === "Just researching"
          ? "No rush then — we'll send the detail and leave you to it."
          : "Last thing, then we'll come back to you.",
      };
    }
    return null;
  };

  const r = reply();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "");
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("We need a name and an email that works.");
      return;
    }
    setError("");
    // TODO: no endpoint wired — send `a` plus these fields to the CRM.
    setSent(true);
    setAnnounce("Request captured.");
  };

  if (sent) {
    return (
      <div className="card p-8 sm:p-10">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-copper text-white">
          <Check size={20} strokeWidth={2.4} />
        </span>
        <h3 className="h2 mt-6">Got it.</h3>
        <p className="lead mt-3">
          {a.side === "publisher"
            ? "We'll come back with the campaigns you can run and what they pay."
            : a.side === "advertiser"
              ? "We'll come back with the rate card and current caps for what you picked."
              : "We'll come back with a proposal for the work you described."}
        </p>
        <p className="mt-5 text-[14px] text-muted">
          If it's quicker, call{" "}
          <a href={SITE.phoneHref} className="font-mono text-copper hover:underline">
            {SITE.phone}
          </a>
          .
        </p>
        <button
          onClick={() => {
            setA(EMPTY);
            setStep(0);
            setSent(false);
          }}
          className="btn btn-secondary mt-7"
        >
          Start again
        </button>
        <p className="mt-4 font-mono text-[10.5px] text-muted">
          Nothing was transmitted — no endpoint is connected yet.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {/* progress */}
      <div className="flex items-center gap-3 border-b border-line bg-paper px-5 py-3">
        <div className="flex flex-1 gap-1.5">
          {flow.map((f, i) => (
            <span
              key={f}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? "bg-copper" : "bg-line-strong"
              }`}
            />
          ))}
        </div>
        <span className="font-mono text-[10.5px] tabular-nums text-muted">
          {step + 1} / {flow.length}
        </span>
      </div>

      <div ref={panelRef} tabIndex={-1} className="p-6 outline-none sm:p-8">
        {/* what the site says back */}
        {r && (
          <div className="mb-6">
            <p className="text-[15px] leading-relaxed text-body">{r.text}</p>
            {r.warn && (
              <p className="mt-3 flex gap-2.5 rounded-[5px] border border-[#e4cfae] bg-[#fbf3e6] p-3.5 text-[13.5px] leading-relaxed text-[#7a5412]">
                <AlertCircle size={16} strokeWidth={1.8} className="mt-0.5 flex-none" />
                {r.warn}
              </p>
            )}
          </div>
        )}

        {key === "side" && (
          <Question title="Let's work out what you actually need.">
            <div className="grid gap-2.5">
              {SIDES.map((s) => (
                <Choice
                  key={s.id}
                  on={a.side === s.id}
                  onClick={() => {
                    setA({ ...EMPTY, side: s.id });
                    setStep(1);
                  }}
                >
                  <span className="text-[15px] font-semibold">{s.label}</span>
                  <span className="mt-0.5 block text-[13px] text-body">{s.sub}</span>
                </Choice>
              ))}
            </div>
          </Question>
        )}

        {key === "verticals" && (
          <Question
            title={a.side === "advertiser" ? "Which verticals do you want?" : "Which can you run?"}
            hint="Pick as many as apply."
          >
            <div className="flex flex-wrap gap-2">
              {VERTICALS.map((v) => {
                const closed = a.side === "publisher" && !PUBLISHER_OPEN.includes(v.code);
                return (
                  <button
                    key={v.code}
                    type="button"
                    className="chip"
                    aria-pressed={a.verticals.includes(v.code)}
                    onClick={() => toggle("verticals", v.code)}
                  >
                    {v.code}
                    {closed && <span className="opacity-60">· closed</span>}
                  </button>
                );
              })}
            </div>
          </Question>
        )}

        {key === "services" && (
          <Question title="What do you need help with?" hint="Pick as many as apply.">
            <div className="flex flex-wrap gap-2">
              {SERVICES.slice(0, 8).map((s) => (
                <button
                  key={s.name}
                  type="button"
                  className="chip"
                  aria-pressed={a.services.includes(s.name)}
                  onClick={() => toggle("services", s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Question>
        )}

        {key === "volume" && (
          <Question
            title={a.side === "advertiser" ? "How much can you handle?" : "How much can you send?"}
          >
            <div className="grid gap-2.5 sm:grid-cols-2">
              {(a.side === "advertiser" ? VOLUMES_ADV : VOLUMES_PUB).map((v) => (
                <Choice key={v} on={a.volume === v} onClick={() => setA({ ...a, volume: v })}>
                  <span className="text-[14.5px] font-medium">{v}</span>
                </Choice>
              ))}
            </div>
            {a.side === "publisher" && (
              <div className="mt-6">
                <p className="mono-label mb-2.5">Where does it come from?</p>
                <div className="flex flex-wrap gap-2">
                  {TRAFFIC_SOURCES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="chip"
                      aria-pressed={a.sources.includes(t)}
                      onClick={() => toggle("sources", t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Question>
        )}

        {key === "timeline" && (
          <Question title="When do you want this running?">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {TIMELINES.map((t) => (
                <Choice key={t} on={a.timeline === t} onClick={() => setA({ ...a, timeline: t })}>
                  <span className="text-[14.5px] font-medium">{t}</span>
                </Choice>
              ))}
            </div>
          </Question>
        )}

        {key === "details" && (
          <form onSubmit={submit}>
            <Question title="Who should we come back to?">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="field">
                  <label htmlFor="q-name">Your name</label>
                  <input id="q-name" name="name" type="text" autoComplete="name" />
                </div>
                <div className="field">
                  <label htmlFor="q-email">Work email</label>
                  <input id="q-email" name="email" type="email" autoComplete="email" />
                </div>
                <div className="field">
                  <label htmlFor="q-company">Company</label>
                  <input id="q-company" name="company" type="text" autoComplete="organization" />
                </div>
                <div className="field">
                  <label htmlFor="q-phone">Phone</label>
                  <input id="q-phone" name="phone" type="tel" autoComplete="tel" />
                </div>
              </div>
            </Question>

            {/* Everything it heard, shown back before they commit. */}
            <Summary a={a} />

            {error && <p className="mt-4 text-[13.5px] text-[#9b3f2c]">{error}</p>}

            <div className="mt-6 flex items-center gap-3">
              <button type="button" onClick={back} className="btn btn-secondary">
                <ArrowLeft size={15} strokeWidth={2} />
                Back
              </button>
              <button type="submit" className="btn">
                Send it
                <ArrowRight size={15} strokeWidth={2} />
              </button>
            </div>
          </form>
        )}

        {!isLast && (
          <div className="mt-7 flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={back} className="btn btn-secondary">
                <ArrowLeft size={15} strokeWidth={2} />
                Back
              </button>
            )}
            {key !== "side" && (
              <button type="button" onClick={next} disabled={!canAdvance} className="btn">
                Continue
                <ArrowRight size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[21px] font-semibold leading-snug tracking-[-0.02em]">{title}</h3>
      {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function Choice({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-[6px] border p-4 text-left transition-all duration-150 ${
        on
          ? "border-copper bg-copper-wash shadow-[inset_0_0_0_1px_var(--color-copper)]"
          : "border-line-strong bg-paper hover:border-copper"
      }`}
    >
      {children}
    </button>
  );
}

function Summary({ a }: { a: Answers }) {
  const bits = [
    a.side === "advertiser" ? "Buying leads" : a.side === "publisher" ? "Sending traffic" : "Marketing services",
    a.verticals.length ? a.verticals.join(", ") : null,
    a.services.length ? `${a.services.length} services` : null,
    a.volume || null,
    a.sources.length ? a.sources.join(", ") : null,
    a.timeline || null,
  ].filter(Boolean) as string[];

  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="mono-label">What we've got so far</p>
      <ul className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1.5">
        {bits.map((b) => (
          <li key={b} className="pill">{b}</li>
        ))}
      </ul>
    </div>
  );
}
