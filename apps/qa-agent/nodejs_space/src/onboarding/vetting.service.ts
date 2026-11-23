import { Injectable, Logger } from '@nestjs/common';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Automatic publisher vetting. Runs when an application comes in and stores a risk score (0-100),
 * a level (low / medium / high) and the reasons, so the reviewer sees red flags before approving.
 * It never approves or rejects on its own.
 */

const FREE_EMAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|aol|icloud|me|mac|proton|protonmail|gmx|mail|zoho|yandex)\.[a-z.]+$/i;
const PHONE_ON_PAGE = /(tel:|\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b|1-8(00|33|44|55|66|77|88)-)/i;
const CONSENT_ON_PAGE = /(tcpa|express written consent|by clicking|you agree to be contacted|consent to (be )?contact|autodialed|prerecorded)/i;

type Flag = { points: number; text: string };

@Injectable()
export class VettingService {
  private readonly logger = new Logger(VettingService.name);
  constructor(private readonly prisma: PrismaService) {}

  /** Blocks private / local addresses so a submitted URL can't be used to probe our own network. */
  private async safeHost(host: string): Promise<boolean> {
    try {
      const ips = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
      return ips.every(({ address }) => !/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|fc|fd|fe80)/i.test(address));
    } catch {
      return false;
    }
  }

  private async fetchPage(raw: string): Promise<{ ok: boolean; status?: number; html?: string; host?: string }> {
    try {
      let url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
      const host = url.hostname.replace(/^www\./, '');
      // Follow up to 4 redirects by hand so every hop is checked against private addresses.
      for (let hop = 0; hop < 5; hop++) {
        if (!/^https?:$/.test(url.protocol) || !(await this.safeHost(url.hostname))) return { ok: false, host };
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrovLabsVetting/1.0)' } });
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) { url = new URL(loc, url); continue; }
        const html = (await res.text()).slice(0, 300_000);
        return { ok: res.ok, status: res.status, html, host };
      }
      return { ok: false, host };
    } catch {
      return { ok: false };
    }
  }

  /** Domain registration date from RDAP (free, no key). */
  private async domainAgeDays(host: string): Promise<number | null> {
    try {
      const root = host.split('.').slice(-2).join('.');
      const res = await fetch(`https://rdap.org/domain/${root}`, {
        signal: AbortSignal.timeout(6000),
        // rdap.org rejects requests without a browser-like User-Agent.
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrovLabsVetting/1.0)', Accept: 'application/rdap+json, application/json' },
      });
      if (!res.ok) return null;
      const j: any = await res.json();
      const reg = (j.events || []).find((e: any) => e.eventAction === 'registration')?.eventDate;
      return reg ? Math.floor((Date.now() - new Date(reg).getTime()) / 864e5) : null;
    } catch {
      return null;
    }
  }

  async vetApplications(applicationIds: string[]) {
    const apps = await this.prisma.vendor_application.findMany({ where: { id: { in: applicationIds } } });
    if (!apps.length) return null;
    const a = apps[0];
    const flags: Flag[] = [];
    const checks: Record<string, any> = {};
    const add = (points: number, text: string) => flags.push({ points, text });

    // Email
    if (FREE_EMAIL.test(a.email)) add(15, 'Free email address (not a company domain)');
    const emailDomain = a.email.split('@')[1]?.toLowerCase() || '';

    // Website
    if (!a.website?.trim()) add(15, 'No company website');
    else {
      const site = await this.fetchPage(a.website.trim());
      checks.website = { live: site.ok, status: site.status ?? null, host: site.host ?? null };
      if (!site.ok) add(20, `Website not loading${site.status ? ` (HTTP ${site.status})` : ''}`);
      if (site.host) {
        const age = await this.domainAgeDays(site.host);
        checks.domain_age_days = age;
        if (age != null && age < 180) add(20, `Website domain is only ${age} days old`);
        else if (age != null && age < 365) add(10, `Website domain is under a year old (${age} days)`);
        if (!FREE_EMAIL.test(a.email) && emailDomain && !emailDomain.endsWith(site.host) && !site.host.endsWith(emailDomain)) add(5, `Email domain (${emailDomain}) doesn't match website (${site.host})`);
      }
    }

    // Sample ad / landing page
    if (a.sample_url) {
      const sample = await this.fetchPage(a.sample_url);
      checks.sample = { live: sample.ok, status: sample.status ?? null, phone: false, consent: false };
      if (!sample.ok) add(15, 'Sample ad / landing page not loading');
      else {
        checks.sample.phone = PHONE_ON_PAGE.test(sample.html || '');
        checks.sample.consent = CONSENT_ON_PAGE.test(sample.html || '');
        if (!checks.sample.phone && ['landing_page', 'click_to_call'].includes(a.lead_method || '')) add(10, 'No phone number found on the sample page');
        if (a.lead_method === 'lead_to_call' && !checks.sample.consent) add(15, 'Lead-to-call, but no consent language found on the sample page');
      }
    } else add(10, 'No sample ad or landing page');

    // Traffic method
    if (a.lead_method === 'live_transfer') add(10, 'Live / warm transfers: confirm it is approved for this campaign');
    if (a.lead_method === 'lead_to_call' && (a.consent_language || '').length < 40) add(15, 'Lead-to-call without consent language');
    if (/Email \/ SMS/.test(a.traffic_sources || '')) add(10, 'Email / SMS traffic: check opt-in records');
    if (/Own call center/.test(a.traffic_sources || '')) add(5, 'Runs its own call center: make sure calls are inbound, not dialed');

    // History: same email, phone, company or website on an earlier application
    const digits = (a.phone || '').replace(/\D/g, '').slice(-10);
    const earlier = await this.prisma.vendor_application.findMany({
      where: {
        id: { notIn: applicationIds },
        OR: [
          { email: a.email },
          { company_name: { equals: a.company_name, mode: 'insensitive' } },
          ...(digits.length === 10 ? [{ phone: { contains: digits.slice(-4) } }] : []),
          ...(a.website ? [{ website: a.website }] : []),
        ],
      },
      select: { status: true, phone: true, email: true, company_name: true, status_reason: true },
      take: 50,
    });
    const samePerson = earlier.filter((e) => e.email === a.email || e.company_name.toLowerCase() === a.company_name.toLowerCase() || (digits.length === 10 && (e.phone || '').replace(/\D/g, '').endsWith(digits)));
    const rejected = samePerson.filter((e) => e.status === 'rejected');
    if (rejected.length) add(30, `Rejected before${rejected[0].status_reason ? `: ${rejected[0].status_reason}` : ''}`);
    else if (samePerson.length) add(0, `Applied before (${samePerson.length} earlier application${samePerson.length > 1 ? 's' : ''})`);

    // Size vs history
    const age = checks.domain_age_days as number | null | undefined;
    if (a.estimated_volume === '100+' && age != null && age < 365) add(10, 'Claims 100+ calls/day with a new domain');
    if (a.company_country && a.company_country !== 'United States') add(5, `Company based outside the US (${a.company_country})`);

    const score = Math.min(100, flags.reduce((s, f) => s + f.points, 0));
    const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
    const risk_flags = { flags: flags.map((f) => ({ points: f.points, text: f.text })), checks };
    await this.prisma.vendor_application.updateMany({
      where: { id: { in: applicationIds } },
      data: { risk_score: score, risk_level: level, risk_flags: risk_flags as any, vetted_at: new Date() },
    });
    this.logger.log(`Vetted ${a.company_name}: ${level} (${score})`);
    return { score, level, flags };
  }
}
