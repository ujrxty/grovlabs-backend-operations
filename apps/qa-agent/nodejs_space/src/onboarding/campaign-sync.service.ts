import { Injectable, Logger, OnModuleInit, OnModuleDestroy, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TrackDriveService } from '../trackdrive/trackdrive.service.js';

/**
 * Keeps the vendor portal's campaign list in step with TrackDrive.
 *
 * - One card per VERTICAL (Plumbing, Pest Control, HVAC...), built from every active (unpaused) TrackDrive offer
 *   whose name matches that vertical. "Pest Inbounds" + "Pest Control CPL" + "Pest Control Inbounds RTB" = one card.
 * - Payout shown = what publishers were actually paid on recent calls (TrackDrive pays most offers as a % of the
 *   buyer bid, so there is no fixed number to copy). Fixed USD payouts are used when there is no call history.
 * - Fields an admin edited by hand (campaign.manual_overrides) are never overwritten by the sync.
 * - Duplicate portal campaigns in the same vertical are merged into one (applications + IOs move over).
 * - A vertical with no active offers left is hidden (is_active=false) until an offer comes back.
 */

type Vertical = { key: string; name: string; industry: string; re: RegExp; description: string; callTypes: string; requirements: string };

const HOME_REQ =
  'Inbound calls only. Caller must be the homeowner (or authorized) and need service now. Dynamic buffer 60 to 120 seconds. No IVR-forced, transferred or incentivized traffic. TCPA-compliant consent required on any lead-to-call traffic.';
const INS_REQ =
  'Inbound calls only. Caller must be the person shopping for coverage. No IVR-forced, transferred or incentivized traffic. TCPA-compliant consent required on any lead-to-call traffic. Creatives must be approved before launch.';

export const VERTICALS: Vertical[] = [
  { key: 'plumbing', name: 'Plumbing', industry: 'Home Services', re: /plumb/i,
    description: 'Inbound calls from homeowners who need a plumber now.',
    callTypes: 'Leaks and burst pipes, clogged drains, sewer lines, water heaters, general repair and installs', requirements: HOME_REQ },
  { key: 'pest_control', name: 'Pest Control', industry: 'Home Services', re: /pest/i,
    description: 'Inbound calls from homeowners with an active pest problem.',
    callTypes: 'General pest, termites, bed bugs, rodents, ants, roaches, mosquitoes', requirements: `${HOME_REQ} No wildlife removal.` },
  { key: 'hvac', name: 'HVAC', industry: 'Home Services', re: /hvac|heating|air ?condition/i,
    description: 'Inbound calls from homeowners who need heating or cooling service.',
    callTypes: 'AC repair, heating and furnace repair, new system installs, maintenance and tune-ups', requirements: HOME_REQ },
  { key: 'roofing', name: 'Roofing', industry: 'Home Services', re: /roof/i,
    description: 'Inbound calls from homeowners who need roof work.',
    callTypes: 'Roof repair, full replacement, storm and hail damage, leak inspections', requirements: HOME_REQ },
  { key: 'windows', name: 'Windows Installation', industry: 'Home Services', re: /window/i,
    description: 'Inbound calls from homeowners looking to replace or install windows.',
    callTypes: 'Window replacement, new window installs', requirements: HOME_REQ },
  { key: 'bathroom', name: 'Bathroom Remodeling', industry: 'Home Services', re: /bath/i,
    description: 'Inbound calls from homeowners planning a bathroom remodel.',
    callTypes: 'Full remodels, tub and shower conversions, walk-in tubs', requirements: HOME_REQ },
  { key: 'home_insurance', name: 'Home Insurance', industry: 'Insurance', re: /home insurance|\bHIC\b/i,
    description: 'Inbound calls from consumers shopping for homeowners insurance.',
    callTypes: 'New policies, quotes, switching carriers', requirements: INS_REQ },
  { key: 'auto_insurance', name: 'Auto Insurance', industry: 'Insurance', re: /auto (insurance|inbound)|\bAIC\b/i,
    description: 'Inbound calls from drivers shopping for auto insurance.',
    callTypes: 'New policies, quotes, switching carriers', requirements: INS_REQ },
  { key: 'medicare', name: 'Medicare', industry: 'Insurance', re: /medicare/i,
    description: 'Inbound calls from Medicare-eligible consumers.',
    callTypes: 'Medicare Advantage, supplement and plan reviews', requirements: `${INS_REQ} CMS/TPMO-compliant creatives only.` },
  { key: 'aca', name: 'ACA Health Insurance', industry: 'Insurance', re: /\baca\b|obamacare/i,
    description: 'Inbound calls from consumers shopping for ACA health coverage.',
    callTypes: 'Marketplace plans, subsidies, open and special enrollment', requirements: INS_REQ },
  { key: 'final_expense', name: 'Final Expense', industry: 'Insurance', re: /final expense/i,
    description: 'Inbound calls from seniors shopping for final expense / burial coverage.',
    callTypes: 'Final expense, burial and whole life', requirements: INS_REQ },
  { key: 'ssdi', name: 'SSDI', industry: 'Legal', re: /ssdi|disability/i,
    description: 'Inbound calls from people looking for help with a disability claim.',
    callTypes: 'SSDI / SSI claims', requirements: 'Inbound calls only. No IVR-forced, transferred or incentivized traffic. TCPA-compliant consent required.' },
];

/** Fields the sync writes. If an admin edits one by hand it goes into manual_overrides and the sync leaves it alone. */
export const SYNCED_FIELDS = ['name', 'sort_order', 'industry', 'call_type', 'description', 'payout', 'payout_display', 'payout_type', 'min_duration', 'geographic_focus', 'requirements', 'hours', 'is_active'];

const DEFAULT_HOURS = '9:00 AM to 9:00 PM EST, Mon to Sun';
const SYNC_EVERY_MS = 15 * 60 * 1000;
const PAYOUT_STATS_EVERY_MS = 6 * 60 * 60 * 1000;

@Injectable()
export class CampaignSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private payoutStats = new Map<string, number[]>(); // vertical key -> publisher payouts on recent calls
  private payoutStatsAt = 0;
  lastResult: any = null;

  constructor(private readonly prisma: PrismaService, private readonly td: TrackDriveService) {}

  onModuleInit() {
    if (process.env.CAMPAIGN_SYNC_DISABLED === 'true') return this.logger.log('Campaign sync disabled');
    setTimeout(() => this.sync().catch((e) => this.logger.error(`Campaign sync failed: ${e.message}`)), 90_000);
    this.timer = setInterval(() => this.sync().catch((e) => this.logger.error(`Campaign sync failed: ${e.message}`)), SYNC_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  verticalFor(name: string): Vertical | null {
    return VERTICALS.find((v) => v.re.test(name || '')) || null;
  }

  /** Publisher payouts per offer over the last 14 days (cached 6h). */
  private async refreshPayoutStats(force = false) {
    if (!force && Date.now() - this.payoutStatsAt < PAYOUT_STATS_EVERY_MS && this.payoutStats.size) return;
    const from = new Date(Date.now() - 14 * 864e5).toISOString(), to = new Date().toISOString();
    const stats = new Map<string, number[]>();
    let cursor: string | null = null;
    for (let page = 0; page < 80; page++) {
      const params: Record<string, any> = { per_page: 100, sort_by: 'created_at', sort_order: 'asc', created_at_from: from, created_at_to: to, columns: 'id,offer,payout' };
      if (cursor) params.cursor = cursor;
      const res = await this.td.listCalls(params);
      const rows: any[] = res?.calls || [];
      for (const c of rows) {
        const p = Number(c.payout) || 0;
        const v = p > 0 && c.offer ? this.verticalFor(String(c.offer)) : null;
        if (v) {
          if (!stats.has(v.key)) stats.set(v.key, []);
          stats.get(v.key)!.push(p);
        }
      }
      cursor = res?.metadata?.next_cursor ? String(res.metadata.next_cursor) : null;
      if (!cursor || !rows.length) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    this.payoutStats = stats;
    this.payoutStatsAt = Date.now();
  }

  private payoutFor(verticalKey: string, offers: any[], convs: any[]): { payout: number; display: string; type: string; minDuration: number | null } {
    const paid: number[] = this.payoutStats.get(verticalKey) || [];
    const ids = new Set(offers.map((o) => String(o.id)));
    const myConvs = convs.filter((c) => ids.has(String(c.offer_id)));
    const fixed = myConvs.filter((c) => c.payout_type === 'usd' && Number(c.payout) > 0).map((c) => Number(c.payout));
    const durations = myConvs.map((c) => Number(c.duration) || 0).filter((d) => d > 1);
    const minDuration = durations.length ? Math.min(...durations) : null;

    if (paid.length >= 5) {
      const s = [...paid].sort((a, b) => a - b);
      const lo = Math.max(5, Math.round(s[Math.floor(s.length * 0.1)] / 5) * 5);
      const hi = Math.max(lo, Math.ceil(s[s.length - 1] / 5) * 5);
      return { payout: hi, display: lo === hi ? `$${hi}` : `$${lo} to $${hi}`, type: 'per_call', minDuration };
    }
    if (fixed.length) {
      const lo = Math.min(...fixed), hi = Math.max(...fixed);
      return { payout: hi, display: lo === hi ? `$${hi}` : `$${lo} to $${hi}`, type: 'per_call', minDuration };
    }
    return { payout: 0, display: 'Variable (RTB)', type: 'per_call', minDuration };
  }

  async sync(opts: { forcePayouts?: boolean } = {}) {
    if (this.running) return { skipped: 'already running' };
    this.running = true;
    try {
      const [offersRes, convRes] = await Promise.all([this.td.listOffers({ per_page: 200 }), this.td.listOfferConversions({ per_page: 200 })]);
      const offers: any[] = (offersRes?.offers || []).filter((o: any) => !o.deleted_at);
      const convs: any[] = convRes?.offer_conversions || [];
      await this.refreshPayoutStats(!!opts.forcePayouts).catch((e) => this.logger.warn(`Payout stats failed: ${e.message}`));

      const active = offers.filter((o) => !o.paused);
      const byVertical = new Map<string, any[]>();
      const unmatched: string[] = [];
      for (const o of active) {
        const v = this.verticalFor(o.name);
        if (!v) { unmatched.push(o.name); continue; }
        if (!byVertical.has(v.key)) byVertical.set(v.key, []);
        byVertical.get(v.key)!.push(o);
      }

      const result = { live: [] as string[], hidden: [] as string[], created: [] as string[], merged: [] as string[], unmatched };
      const all = await this.prisma.campaign.findMany({ where: { archived: false }, include: { _count: { select: { applications: true } } } });
      const liveIds = new Set<string>();

      for (const v of VERTICALS) {
        const vOffers = byVertical.get(v.key) || [];
        const matching = all.filter((c) => c.vertical_key === v.key || (!c.vertical_key && v.re.test(c.name)));
        if (!vOffers.length) {
          // No active offer: hide whatever card this vertical has (unless the admin pinned is_active by hand).
          for (const c of matching.filter((c) => c.vertical_key === v.key && c.is_active && !c.manual_overrides.includes('is_active'))) {
            await this.prisma.campaign.update({ where: { id: c.id }, data: { is_active: false, trackdrive_offer_ids: [], synced_at: new Date() } });
            result.hidden.push(c.name);
          }
          continue;
        }

        // Primary = the one already linked to this vertical, else the one with the most applications, else the oldest.
        let primary = matching.find((c) => c.vertical_key === v.key)
          || [...matching].sort((a, b) => b._count.applications - a._count.applications || +a.created_at - +b.created_at)[0];

        const pay = this.payoutFor(v.key, vOffers, convs);
        const fields: Record<string, any> = {
          name: v.name, industry: v.industry, call_type: 'Inbound Calls', description: `${v.description} Call types: ${v.callTypes}.`,
          payout: pay.payout, payout_display: pay.display, payout_type: pay.type,
          min_duration: pay.minDuration ?? (v.industry === 'Home Services' ? 60 : null),
          geographic_focus: 'Nationwide', requirements: v.requirements, hours: DEFAULT_HOURS, is_active: true,
          sort_order: (VERTICALS.indexOf(v) + 1) * 10,
        };

        if (!primary) {
          const taken = await this.prisma.campaign.findUnique({ where: { name: v.name } });
          primary = await this.prisma.campaign.create({
            data: { ...fields, name: taken ? `${v.name} Calls` : v.name, billing_cycle: 'biweekly', source: 'trackdrive', vertical_key: v.key, trackdrive_offer_ids: vOffers.map((o) => String(o.id)), synced_at: new Date() } as any,
            include: { _count: { select: { applications: true } } },
          });
          result.created.push(primary.name);
        } else {
          const data: Record<string, any> = {};
          for (const [k, val] of Object.entries(fields)) if (!primary.manual_overrides.includes(k)) data[k] = val;
          // Don't collide with another campaign's unique name.
          if (data.name && data.name !== primary.name && (await this.prisma.campaign.findUnique({ where: { name: data.name } }))) {
            const other = await this.prisma.campaign.findUnique({ where: { name: data.name } });
            if (other && other.id !== primary.id && matching.some((m) => m.id === other.id)) {
              await this.merge(other.id, primary.id); result.merged.push(`${other.name} → ${primary.name}`);
            } else delete data.name;
          }
          await this.prisma.campaign.update({
            where: { id: primary.id },
            data: { ...data, source: 'trackdrive', vertical_key: v.key, trackdrive_offer_ids: vOffers.map((o) => String(o.id)), synced_at: new Date() },
          });
        }

        // Fold every other portal campaign in this vertical into the primary one.
        for (const dup of matching.filter((c) => c.id !== primary!.id)) {
          const still = await this.prisma.campaign.findUnique({ where: { id: dup.id } });
          if (!still || still.archived) continue;
          await this.merge(dup.id, primary.id);
          result.merged.push(`${dup.name} → ${v.name}`);
        }
        result.live.push(`${v.name} (${vOffers.length} offer${vOffers.length > 1 ? 's' : ''}, ${pay.display})`);
        liveIds.add(primary.id);
      }

      // Only live TrackDrive offers exist on the portal.
      // - Hand-made campaigns with no TrackDrive offer (Mold Removal, Gutters...) are archived: gone from the portal
      //   AND the admin list, rows kept for history.
      // - TrackDrive cards whose offers are all paused just go inactive, so they come back when the offer does.
      // Safety: if TrackDrive returned no offers at all (API hiccup), touch nothing.
      if (offers.length > 0 && liveIds.size > 0) {
        const others = await this.prisma.campaign.findMany({ where: { archived: false, id: { notIn: [...liveIds] } } });
        for (const c of others) {
          if (c.source !== 'trackdrive') {
            await this.prisma.campaign.update({
              where: { id: c.id },
              data: { is_active: false, archived: true, vertical_key: null, name: `${c.name} [archived ${c.id.slice(0, 6)}]`, synced_at: new Date() },
            });
            result.hidden.push(`${c.name} (archived)`);
          } else if (c.is_active && !c.manual_overrides.includes('is_active')) {
            await this.prisma.campaign.update({ where: { id: c.id }, data: { is_active: false, synced_at: new Date() } });
            result.hidden.push(c.name);
          }
        }
      }

      this.lastResult = { at: new Date().toISOString(), ...result };
      if (result.created.length || result.merged.length || result.hidden.length)
        this.logger.log(`Campaign sync: created ${result.created.join(', ') || '-'} | merged ${result.merged.join(', ') || '-'} | hidden ${result.hidden.join(', ') || '-'}`);
      return this.lastResult;
    } finally {
      this.running = false;
    }
  }

  /** Move applications + IOs from one campaign to another, then archive the source (hidden everywhere). */
  async merge(fromId: string, intoId: string) {
    if (fromId === intoId) throw new BadRequestException('Cannot merge a campaign into itself');
    const [from, into] = await Promise.all([
      this.prisma.campaign.findUnique({ where: { id: fromId } }),
      this.prisma.campaign.findUnique({ where: { id: intoId } }),
    ]);
    if (!from || !into) throw new NotFoundException('Campaign not found');
    const [apps, ios] = await this.prisma.$transaction([
      this.prisma.vendor_application.updateMany({ where: { campaign_id: fromId }, data: { campaign_id: intoId } }),
      this.prisma.insertion_order.updateMany({ where: { campaign_id: fromId }, data: { campaign_id: intoId } }),
      this.prisma.campaign.update({
        where: { id: fromId },
        // Free the unique name so it can be reused, keep the row for history.
        data: { is_active: false, archived: true, merged_into_id: intoId, vertical_key: null, name: `${from.name} [merged ${fromId.slice(0, 6)}]` },
      }),
    ]);
    return { message: `Merged "${from.name}" into "${into.name}"`, applications_moved: apps.count, ios_moved: ios.count };
  }
}
