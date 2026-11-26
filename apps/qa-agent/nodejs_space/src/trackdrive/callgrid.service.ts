import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { TrackDriveService } from './trackdrive.service.js';

/**
 * CallGrid (replacing TrackDrive) for the QA agent. CallGrid posts a webhook per call
 * (POST /webhooks/callgrid with {"CallId": "[[tag:CallId]]"}); we fetch the call and hand the
 * QA pipeline the same payload TrackDrive's webhook sends, keyed to the TrackDrive buyer /
 * traffic source ids the dashboard, affiliate scores and Overwatch already use:
 *
 *   destination -> TrackDrive buyer    (each CallGrid destination's notes say "TrackDrive: <buyer name>")
 *   vendor      -> TrackDrive traffic source (normalized name, "1 PM" -> "1025 - 1PM")
 *   campaign    -> TrackDrive offer name (table below)
 */
export const CAMPAIGN_TO_TD_OFFER: Record<string, string> = {
  'Plumbing Inbounds': 'Plumbing', 'Pest Control Inbounds': 'Pest Inbounds', 'HVAC Inbounds': 'HVAC',
  'HVAC Static Inbounds': 'HVAC - Static Inbound', 'Roofing Inbounds': 'Roofing', 'Windows Installation Inbounds': 'Windows Installation',
  'Bathroom Remodeling Inbounds': 'Bathroom Remodeling', 'Home Insurance Inbounds': 'Home Insurance Calls',
  'Auto Insurance Inbounds': 'Auto Inbounds Calls', 'Medicare Inbounds': 'Medicare Inbounds', 'ACA Inbounds': 'ACA Inbounds',
  'Final Expense Inbounds': 'Final Expense inbounds RTB', 'Pest Control CPL': 'Pest Control CPL', 'ACA Transfers': 'ACA Transfers',
  'SSDI Transfers': 'SSDI', 'Final Expense CPA': 'Final Expense',
};
export { downloadCallGridRecording } from './callgrid-recording.js';
import { downloadCallGridRecording, isCallGridRecording } from './callgrid-recording.js';

const norm = (s: any) => String(s || '').toLowerCase().replace(/^\d+\s*-\s*/, '').replace(/[^a-z0-9]/g, '');
type Ref = { id: string; name: string };

@Injectable()
export class CallGridService {
  private readonly logger = new Logger(CallGridService.name);
  private client: AxiosInstance | null = null;
  private mapCache: { at: number; buyer: Map<string, Ref>; source: Map<string, Ref> } | null = null;

  constructor(private readonly config: ConfigService, private readonly trackdrive: TrackDriveService) {}

  enabled(): boolean {
    return !!this.config.get<string>('CALLGRID_API_KEY');
  }

  private http(): AxiosInstance {
    if (!this.client) {
      this.client = axios.create({
        baseURL: 'https://api.callgrid.com/api',
        headers: { Authorization: `Bearer ${this.config.get<string>('CALLGRID_API_KEY')}`, Accept: 'application/json' },
        timeout: 30000,
      });
    }
    return this.client;
  }

  private async get(path: string): Promise<any> {
    for (let attempt = 1; ; attempt++) {
      try { const d = (await this.http().get(path)).data; return d?.data ?? d; }
      catch (e: any) {
        const s = e?.response?.status;
        if ((s === 429 || s >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
        throw e;
      }
    }
  }

  async getCall(callId: string): Promise<any> {
    return this.get(`/call/${encodeURIComponent(callId)}`);
  }

  /**
   * Every CallGrid call in a time range, as TrackDrive-shaped payloads (same shape the webhook uses),
   * so the daily QA jobs (non-conversion + sales) can review CallGrid calls next to TrackDrive ones.
   */
  async callsForRange(fromIso: string, toIso: string, maxPages = 40): Promise<Record<string, any>[]> {
    if (!this.enabled()) return [];
    const raw: any[] = [];
    let after: any = null;
    for (let page = 0; page < maxPages; page++) {
      const params = new URLSearchParams({ startDate: new Date(fromIso).toISOString(), endDate: new Date(toIso).toISOString(), maxItems: '500', useCursor: 'true' });
      if (after) params.set('searchAfter', JSON.stringify(after));
      let res: any;
      for (let attempt = 1; ; attempt++) {
        try { res = (await this.http().get(`/call?${params}`)).data; break; }
        catch (e: any) {
          const s = e?.response?.status;
          if ((s === 429 || s >= 500) && attempt < 4) { await new Promise((r) => setTimeout(r, 2000 * attempt)); continue; }
          throw e;
        }
      }
      raw.push(...(res?.data || []));
      if (!res?.hasMore || !res?.nextCursor) break;
      after = res.nextCursor;
    }
    const out: Record<string, any>[] = [];
    for (const c of raw) out.push(await this.toTrackdrivePayload(c));
    this.logger.log(`CallGrid ${fromIso} -> ${toIso}: ${out.length} calls`);
    return out;
  }

  private async tdSources(): Promise<any[]> {
    const out: any[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 50; page++) {
      const d: any = await this.trackdrive.listTrafficSources({ per_page: 200, ...(cursor ? { cursor } : {}) });
      const rows: any[] = Array.isArray(d) ? d : d?.traffic_sources || [];
      out.push(...rows);
      cursor = d?.metadata?.next_cursor ? String(d.metadata.next_cursor) : null;
      if (!cursor || !rows.length) break;
    }
    return out;
  }

  private async maps() {
    if (this.mapCache && Date.now() - this.mapCache.at < 3600_000) return this.mapCache;
    const [dests, vendors, buyersRaw, sources] = await Promise.all([this.get('/destination'), this.get('/vendor'), this.trackdrive.listBuyers(), this.tdSources()]);
    const buyers: any[] = Array.isArray(buyersRaw) ? buyersRaw : buyersRaw?.buyers || [];
    const buyer = new Map<string, Ref>();
    for (const d of dests || []) {
      const tdName = String(d.notes || '').match(/^TrackDrive: (.+)$/m)?.[1]?.trim();
      const hit = tdName ? buyers.find((b: any) => String(b.name || '').trim() === tdName) : null;
      buyer.set(d.id, hit ? { id: String(hit.id), name: String(hit.name) } : { id: `cg:${d.id}`, name: String(d.name).trim() });
    }
    const source = new Map<string, Ref>();
    for (const v of vendors || []) {
      const nv = norm(v.name);
      const hit = sources.find((t: any) => norm(t.name) === nv) || sources.find((t: any) => norm(t.name).includes(nv) || nv.includes(norm(t.name)));
      source.set(v.id, hit ? { id: String(hit.id), name: String(hit.name) } : { id: `cg:${v.id}`, name: String(v.name).trim() });
    }
    this.mapCache = { at: Date.now(), buyer, source };
    return this.mapCache;
  }

  /**
   * A CallGrid call as the payload TrackDrive's call webhook would have sent (id prefixed "cg:").
   * GET /call/{id} nests every field under `tags` as strings ("true"/"312") and puts the recording
   * in `audioUrl`; the list endpoint returns the same fields flattened. Accept both shapes.
   */
  async toTrackdrivePayload(raw: any): Promise<Record<string, any>> {
    const c: any = { ...raw, ...(raw?.tags || {}) };
    const yes = (v: any) => v === true || v === 1 || v === 'true' || v === '1';
    const m = await this.maps().catch((e) => { this.logger.warn(`CallGrid name map failed: ${e.message}`); return null; });
    const b = c.DestinationId ? m?.buyer.get(c.DestinationId) || { id: `cg:${c.DestinationId}`, name: c.DestinationName || '' } : null;
    const s = m?.source.get(c.VendorId) || { id: `cg:${c.VendorId}`, name: c.VendorName || 'Unknown' };
    const camp = String(c.CampaignName || '').trim();
    const converted = yes(c.paid) || yes(c.CallPaid) || yes(c.converted);
    return {
      platform: 'callgrid',
      id: `cg:${c.id}`,
      callgrid_id: c.id,
      created_at: c.createdAt || c.date || c.UTCISODate,
      offer: CAMPAIGN_TO_TD_OFFER[camp] || camp || 'Unknown',
      offer_id: c.CampaignId || c.campaignId || '',
      buyer: b?.name || '', buyer_id: b?.id || '',
      traffic_source: s.name, traffic_source_name: s.name, traffic_source_id: s.id,
      buyer_converted: converted ? 'Converted' : 'Not Converted',
      revenue: Number(c.revenue ?? c.RevenueAmount ?? c.CallRevenue ?? 0) || 0,
      payout: Number(c.payout ?? c.PayoutAmount ?? c.CallPayout ?? 0) || 0,
      total_duration: Number(c.CallDurationFromInbound ?? c.callDuration ?? c.CallDuration ?? 0) || 0,
      answered_duration: Number(c.CallDurationFromConnect ?? 0) || 0,
      recording_url: c.audioUrl || c.callRecordingUrl || c.s3FileUrl || '',
      caller_number: c.CallerId || c.from || '',
      caller_state: c.InboundStateCode || '',
      'token-state': c.InboundStateCode || '',
      caller_city: c.InboundCity || '',
      status: String(c.callStatus || c.CallStatus || '').toLowerCase(),
    };
  }

  /** CallGrid recording links may need the API key; try plain first (same as TrackDrive links). */
  async downloadRecording(url: string): Promise<Buffer> {
    if (isCallGridRecording(url)) return downloadCallGridRecording(url, this.config.get<string>('CALLGRID_API_KEY') || '');
    try {
      return Buffer.from((await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 })).data);
    } catch (e: any) {
      if (![401, 403].includes(e?.response?.status)) throw e;
      const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000, headers: { Authorization: `Bearer ${this.config.get<string>('CALLGRID_API_KEY')}` } });
      return Buffer.from(r.data);
    }
  }
}
