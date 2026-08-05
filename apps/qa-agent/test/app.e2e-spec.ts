import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('BSBW QA Agent (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('GET /health - should return health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.database).toBe('connected');
          expect(res.body.queue).toBeDefined();
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('Webhook', () => {
    it('POST /webhooks/trackdrive - should accept valid webhook', () => {
      return request(app.getHttpServer())
        .post('/webhooks/trackdrive')
        .send({
          event: 'call_recording_updated_call_ended',
          call_id: 'e2e-test-call-001',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('accepted');
          expect(res.body.call_id).toBe('e2e-test-call-001');
          expect(res.body.internal_id).toBeDefined();
        });
    });

    it('POST /webhooks/trackdrive - should handle missing call_id', () => {
      return request(app.getHttpServer())
        .post('/webhooks/trackdrive')
        .send({ event: 'unknown' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ignored');
        });
    });
  });

  describe('Affiliates API', () => {
    it('GET /api/affiliates - should return affiliates list', () => {
      return request(app.getHttpServer())
        .get('/api/affiliates')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.pagination).toBeDefined();
        });
    });

    it('GET /api/affiliates/:id - should return 404 for non-existent', () => {
      return request(app.getHttpServer())
        .get('/api/affiliates/non-existent-id')
        .expect(404);
    });
  });

  describe('Analytics API', () => {
    it('GET /api/analytics/dashboard - should return dashboard stats', () => {
      return request(app.getHttpServer())
        .get('/api/analytics/dashboard')
        .expect(200)
        .expect((res) => {
          expect(res.body.overview).toBeDefined();
          expect(res.body.overview.total_calls).toBeDefined();
          expect(res.body.overview.total_flagged).toBeDefined();
          expect(res.body.overview.flag_rate_percent).toBeDefined();
          expect(res.body.severity_breakdown).toBeDefined();
          expect(res.body.top_offenders).toBeDefined();
          expect(res.body.recent_flags).toBeDefined();
        });
    });

    it('GET /api/calls/flagged - should return flagged calls', () => {
      return request(app.getHttpServer())
        .get('/api/calls/flagged')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toBeDefined();
          expect(res.body.pagination).toBeDefined();
        });
    });

    it('GET /api/calls/flagged - should support pagination params', () => {
      return request(app.getHttpServer())
        .get('/api/calls/flagged?page=1&limit=5')
        .expect(200)
        .expect((res) => {
          expect(res.body.pagination.page).toBe(1);
          expect(res.body.pagination.limit).toBe(5);
        });
    });
  });
});
