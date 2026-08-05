import { Wordmark } from "./Nav";
import { FacebookIcon, LinkedinIcon, InstagramIcon } from "./SocialIcons";
import Reveal from "./Reveal";
import { SITE, NAV } from "@/lib/content";

const SOCIALS = [
  { Icon: FacebookIcon, name: "Facebook", href: "#" },
  { Icon: LinkedinIcon, name: "LinkedIn", href: "#" },
  { Icon: InstagramIcon, name: "Instagram", href: "#" },
];

export default function Footer() {
  return (
    <footer className="bg-paper">
      <div className="mx-auto max-w-[1240px] py-12 gut">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr]">
          <Reveal>
            <Wordmark />
            <p className="mt-4 max-w-[42ch] text-[14px] leading-relaxed text-body">
              {SITE.descriptor} across insurance, legal and financial verticals.
            </p>
            <div className="mt-5 flex gap-2">
              {SOCIALS.map(({ Icon, name, href }) => (
                <a
                  key={name}
                  href={href}
                  aria-label={name}
                  className="grid h-9 w-9 place-items-center rounded-[3px] border border-line-strong text-body transition-colors hover:border-ink hover:text-ink"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mono-label">Site</p>
            <ul className="mt-3 space-y-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-[14px] text-body hover:text-copper">
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#contact" className="text-[14px] text-body hover:text-copper">
                  Contact
                </a>
              </li>
            </ul>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mono-label">Contact</p>
            <ul className="mt-3 space-y-2 text-[14px] text-body">
              <li>
                <a href={SITE.phoneHref} className="font-mono hover:text-copper">
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a href={`mailto:${SITE.email}`} className="hover:text-copper">
                  {SITE.email}
                </a>
              </li>
              <li className="pt-2 leading-relaxed">{SITE.hq.lines.join(", ")}</li>
            </ul>
          </Reveal>
        </div>

        <Reveal delay={0.3}>
          <div className="mt-10 flex flex-wrap justify-between gap-4 border-t border-line pt-6 text-[13px] text-muted">
            <span>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</span>
            <span className="flex gap-5">
              <a href="#" className="hover:text-ink">Privacy policy</a>
              <a href="#" className="hover:text-ink">Terms</a>
              <a href="#" className="hover:text-ink">TCPA compliance</a>
            </span>
          </div>
        </Reveal>
      </div>
    </footer>
  );
}
