import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class TrackDriveService {
  private readonly logger = new Logger(TrackDriveService.name);
  private client: AxiosInstance | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getClient(): AxiosInstance {
    if (!this.client) {
      const publicKey = this.configService.get<string>('TRACKDRIVE_PUBLIC_KEY', '');
      const privateKey = this.configService.get<string>('TRACKDRIVE_PRIVATE_KEY', '');
      const authToken = Buffer.from(`${publicKey}:${privateKey}`).toString('base64');

      const baseUrl = this.configService.get<string>('TRACKDRIVE_BASE_URL', 'https://grovlabs.trackdrive.com');
      this.client = axios.create({
        baseURL: `${baseUrl}/api/v1`,
        headers: {
          Authorization: `Basic ${authToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });
    }
    return this.client;
  }

  async getCallDetails(callId: string): Promise<any> {
    try {
      const response = await this.getClient().get(`/calls/${callId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch call details for ${callId}: ${error.message}`);
      throw error;
    }
  }

  async getCallEvents(callId: string): Promise<any> {
    try {
      const response = await this.getClient().get(`/calls/${callId}/events`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to fetch call events for ${callId}: ${error.message}`);
      throw error;
    }
  }

  async downloadRecording(recordingUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(recordingUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
      });
      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Failed to download recording: ${error.message}`);
      throw error;
    }
  }

  async listCalls(params?: Record<string, any>): Promise<any> {
    try {
      const response = await this.getClient().get('/calls', { params });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list calls: ${error.message}`);
      throw error;
    }
  }

  async listPublishers(): Promise<any> {
    try {
      const response = await this.getClient().get('/publishers');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list publishers: ${error.message}`);
      throw error;
    }
  }

  async listBuyers(): Promise<any> {
    try {
      const response = await this.getClient().get('/buyers');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list buyers: ${error.message}`);
      throw error;
    }
  }

  async listCampaigns(): Promise<any> {
    try {
      const response = await this.getClient().get('/campaigns');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list campaigns: ${error.message}`);
      throw error;
    }
  }

  async listTrafficSources(params?: Record<string, any>): Promise<any> {
    try {
      const response = await this.getClient().get('/traffic_sources', { params });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list traffic sources: ${error.message}`);
      throw error;
    }
  }

  async listOffers(params?: Record<string, any>): Promise<any> {
    try {
      const response = await this.getClient().get('/offers', { params });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list offers: ${error.message}`);
      throw error;
    }
  }

  async listOutgoingWebhooks(params?: Record<string, any>): Promise<any> {
    try {
      const response = await this.getClient().get('/outgoing_webhooks', { params });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to list outgoing webhooks: ${error.message}`);
      throw error;
    }
  }

  async pauseTrafficSource(tsId: string, paused: boolean): Promise<any> {
    try {
      const response = await this.getClient().patch(`/traffic_sources/${tsId}`, {
        traffic_source: { paused },
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to pause/unpause traffic source ${tsId}: ${error.message}`);
      throw error;
    }
  }

  async createTrafficSource(data: { company_name: string; first_name?: string; last_name?: string }): Promise<any> {
    try {
      // TrackDrive API requires top-level params, NOT nested under traffic_source
      const payload: Record<string, string> = {
        company_name: data.company_name,
        first_name: data.first_name || data.company_name.split(' ')[0],
      };
      if (data.last_name) payload.last_name = data.last_name;
      const response = await this.getClient().post('/traffic_sources', payload);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to create traffic source: ${error.message}`);
      throw error;
    }
  }

  async createOffer(data: { name: string }): Promise<any> {
    try {
      const response = await this.getClient().post('/offers', {
        offer: data,
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to create offer: ${error.message}`);
      throw error;
    }
  }

  async pauseOffer(offerId: string, paused: boolean): Promise<any> {
    try {
      const response = await this.getClient().patch(`/offers/${offerId}`, {
        offer: { paused },
      });
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to pause/unpause offer ${offerId}: ${error.message}`);
      throw error;
    }
  }

  async getTrafficSource(tsId: string): Promise<any> {
    try {
      const response = await this.getClient().get(`/traffic_sources/${tsId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get traffic source ${tsId}: ${error.message}`);
      throw error;
    }
  }

  async getBuyer(buyerId: string): Promise<any> {
    try {
      const response = await this.getClient().get(`/buyers/${buyerId}`);
      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get buyer ${buyerId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fetch all calls for a date range, paginating through all pages.
   */
  async fetchAllCallsForRange(dateFrom: string, dateTo: string, maxPages = 40): Promise<any[]> {
    const allCalls: any[] = [];
    let cursor: string | null = null;
    let page = 0;

    do {
      page++;
      const params: Record<string, any> = {
        per_page: 50,
        sort_by: 'created_at',
        sort_order: 'asc',
        created_at_from: dateFrom,
        created_at_to: dateTo,
      };
      if (cursor) params.cursor = cursor;

      const response = await this.listCalls(params);
      const calls = response?.calls || [];
      allCalls.push(...calls);

      const metadata = response?.metadata || {};
      cursor = metadata.next_cursor ? String(metadata.next_cursor) : null;

      if (cursor && page < maxPages) {
        await new Promise(r => setTimeout(r, 300));
      }
    } while (cursor && page < maxPages);

    return allCalls;
  }
}
