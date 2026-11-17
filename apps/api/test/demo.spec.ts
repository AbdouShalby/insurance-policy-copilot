import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp, seedSamples } from '../src/app';
import { PolicyService } from '../src/policy.service';

describe('Read-only public demo', () => {
  let app: INestApplication;
  let directory: string;
  let previous: NodeJS.ProcessEnv;
  let ingest: jest.SpyInstance;

  beforeEach(async () => {
    previous = { ...process.env };
    directory = await mkdtemp(join(tmpdir(), 'policy-demo-'));
    process.env.INDEX_PATH = join(directory, 'index.json');
    process.env.DEMO_MODE = 'true';
    delete process.env.REDIS_URL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CRM_WEBHOOK_SECRET;
    ingest = jest.spyOn(global, 'fetch').mockImplementation(async (_url, options) => {
      const id = (options!.body as FormData).get('doc_id') as string;
      return new Response(JSON.stringify({ chunks: [{ doc_id: id, chunk_id: `${id}:p1:c1`,
        title: 'Synthetic policy', page: 1, lang: 'en', text: 'Windscreen damage excess is EGP 5000.' }] }));
    });
    app = await createApp();
    await seedSamples(app.get(PolicyService));
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
    process.env = previous;
    await rm(directory, { recursive: true, force: true });
  });

  const ask = (app: INestApplication, forwarded?: string) => {
    const req = request(app.getHttpServer()).post('/ask');
    if (forwarded) req.set('X-Forwarded-For', forwarded);
    return req.send({ question: 'What is the excess for windscreen damage?' });
  };

  it('rejects uploads before parsing multipart content', async () => {
    const spy = jest.spyOn(app.get(PolicyService), 'ingest');
    const result = await request(app.getHttpServer()).post('/documents')
      .field('doc_id', 'custom').attach('file', Buffer.from('synthetic'), 'custom.txt').expect(403);
    expect(result.body.error.message).toBe('Uploads are disabled in the public demo');
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects public sample loading and unsigned CRM webhooks', async () => {
    for (const route of ['/samples', '/webhooks/crm']) {
      const result = await request(app.getHttpServer()).post(route).send({}).expect(403);
      expect(result.body.error.message).toMatch(/disabled in the public demo/);
    }
    expect(ingest).toHaveBeenCalledTimes(5);
  });

  it('serves the read-only UI and answers from internally seeded policies', async () => {
    const page = await request(app.getHttpServer()).get('/').expect(200);
    expect(page.text).toContain('<section aria-labelledby="setup" hidden>');
    expect(page.text).toContain('Public demo · synthetic data · read-only');
    expect(page.text).not.toContain('type="file"');
    const result = await ask(app).expect(201);
    expect(result.body.mode).toBe('extractive');
    expect(result.body.citations.some((citation: { doc_id: string }) => citation.doc_id === 'motor')).toBe(true);
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('preserves the 2000-character DTO limit', async () => {
    await request(app.getHttpServer()).post('/ask').send({ question: 'x'.repeat(2001) }).expect(400);
    await request(app.getHttpServer()).post('/ask').send({ question: 'x'.repeat(2000) }).expect(201);
  });

  it('limits each nearest forwarded IP to 20 requests and ignores forged leftmost entries', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    for (let i = 0; i < 20; i++) await ask(app, `192.0.2.${i}, 198.51.100.1`).expect(201);
    const result = await ask(app, '192.0.2.250, 198.51.100.1').expect(429);
    expect(result.body.error.message).toContain('Too many questions');
    expect(result.headers['retry-after']).toBe('60');
    await ask(app, '198.51.100.2').expect(201);
    await request(app.getHttpServer()).get('/health').expect(200);
    clock.mockReturnValue(now + 60_000);
    await ask(app, '198.51.100.1').expect(201);
  });

  it('also limits direct clients without forwarded headers', async () => {
    for (let i = 0; i < 20; i++) await ask(app).expect(201);
    await ask(app).expect(429);
  });
});
