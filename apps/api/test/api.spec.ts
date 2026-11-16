import { INestApplication } from '@nestjs/common';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { PolicyService } from '../src/policy.service';
import { LlmAdapter } from '../src/llm';

const chunk = { doc_id: 'motor', title: 'Fictional motor', chunk_id: 'motor:p1:c1', page: 1,
  text: 'Windscreen repairs have a limit of EGP 5000. Theft claims require a police report.', lang: 'en' };

describe('Policy API', () => {
  let app: INestApplication;
  let directory: string;
  let fetchMock: jest.SpyInstance;
  const secret = 'synthetic-test-secret';
  const raw = JSON.stringify({ event_id: 'event-1', case_id: 'case-1', customer_question: 'Windscreen repairs limit?' });
  const sign = (body: string) => 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  const postEvent = (body = raw) => request(app.getHttpServer()).post('/webhooks/crm')
    .set('content-type', 'application/json').set('X-Signature', sign(body)).send(body);
  const upload = () => request(app.getHttpServer()).post('/documents')
    .field('doc_id', 'motor').field('title', 'Fictional motor').attach('file', Buffer.from('synthetic'), 'motor.txt');

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'policy-api-'));
    process.env.INDEX_PATH = join(directory, 'index.json');
    process.env.CRM_WEBHOOK_SECRET = secret;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.REDIS_URL;
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ chunks: [chunk] })));
    app = await createApp();
    await upload().expect(201);
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
    delete process.env.INDEX_PATH;
    delete process.env.CRM_WEBHOOK_SECRET;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.REDIS_URL;
  });

  it('serves the static demo page and loads samples through ingest', async () => {
    const page = await request(app.getHttpServer()).get('/').expect(200).expect('Content-Type', /html/);
    expect(page.text).toContain('Load sample policies');
    expect(page.text).toContain('aria-live');
    fetchMock.mockImplementation(async (_url, options) => {
      const id = (options.body as FormData).get('doc_id') as string;
      return new Response(JSON.stringify({ chunks: [{ ...chunk, doc_id: id, chunk_id: `${id}:p1:c1` }] }));
    });
    await request(app.getHttpServer()).post('/samples').send({}).expect(201, { documents: 5 });
  });

  it('answers with source sentences and citations', async () => {
    const result = await request(app.getHttpServer()).post('/ask').send({ question: 'Windscreen repairs limit?' }).expect(201);
    expect(result.body.mode).toBe('extractive');
    expect(result.body.answer).toContain('EGP 5000');
    expect(result.body.citations[0]).toMatchObject({ doc_id: 'motor', page: 1, chunk_id: chunk.chunk_id });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer()).get('/health').expect(200, { status: 'ok' });
  });

  it('ranks meaningful sentence matches ahead of repeated stop words', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ chunks: [{ ...chunk,
      text: 'The motor policy covers the vehicle in the schedule. Windscreen repairs are covered up to EGP 5000 per year. The conditions in the policy are the applicable conditions.' }] })));
    await upload().expect(201);
    const result = await request(app.getHttpServer()).post('/ask')
      .send({ question: 'What is the windscreen repairs limit?' }).expect(201);
    expect(result.body.answer).toContain('EGP 5000');
  });

  it('abstains on an unrelated or empty-vocabulary query', async () => {
    for (const question of ['Quantum orbital satellites?', 'the and']) {
      const result = await request(app.getHttpServer()).post('/ask').send({ question }).expect(201);
      expect(result.body.answer).toBe('Not found in the policy documents.');
      expect(result.body.citations).toEqual([]);
    }
  });

  it('replaces a document and reloads its persisted index after restart', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ chunks: [{ ...chunk,
      chunk_id: 'motor:p1:c2', text: 'Battery replacement has a limit of EGP 800.' }] })));
    await upload().expect(201);
    await app.close();
    app = await createApp();
    const old = await request(app.getHttpServer()).post('/ask').send({ question: 'Windscreen?' });
    expect(old.body.citations).toEqual([]);
    const current = await request(app.getHttpServer()).post('/ask').send({ question: 'Battery replacement?' });
    expect(current.body.answer).toContain('EGP 800');
    expect(current.body.citations).toHaveLength(1);
  });

  it('validates requests and returns consistent errors', async () => {
    for (const body of [{}, { question: ' ' }, { question: 'Test', top_k: 0 }, { question: 'Test', top_k: '3' },
      { question: 'Test', unexpected: true }]) {
      const result = await request(app.getHttpServer()).post('/ask').send(body).expect(400);
      expect(result.body.statusCode).toBe(400);
      expect(result.body.error.message).toBeDefined();
    }
    await request(app.getHttpServer()).post('/documents').field('doc_id', 'motor')
      .field('title', 'Motor').expect(400);
    await request(app.getHttpServer()).post('/documents').field('doc_id', '../bad')
      .field('title', 'Motor').attach('file', Buffer.from('test'), 'x.txt').expect(400);
  });

  it('rejects absent, invalid, or tampered signatures before processing', async () => {
    const spy = jest.spyOn(app.get(PolicyService), 'ask');
    await request(app.getHttpServer()).post('/webhooks/crm').send(JSON.parse(raw)).expect(401);
    await request(app.getHttpServer()).post('/webhooks/crm').set('X-Signature', 'sha256=wrong').send(JSON.parse(raw)).expect(401);
    await request(app.getHttpServer()).post('/webhooks/crm').set('content-type', 'application/json')
      .set('X-Signature', sign(raw)).send(raw.replace('case-1', 'case-2')).expect(401);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 200 and replays the exact first result without recomputation', async () => {
    const spy = jest.spyOn(app.get(PolicyService), 'ask');
    const first = await postEvent().expect(200);
    const replay = await postEvent().expect(200);
    expect(replay.body).toEqual(first.body);
    expect(first.body.event_id).toBe('event-1');
    expect(first.body.citations[0].doc_id).toBe('motor');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shares pending work between concurrent duplicate deliveries', async () => {
    const policies = app.get(PolicyService);
    const original = policies.ask.bind(policies);
    const spy = jest.spyOn(policies, 'ask').mockImplementation(async (...args) => {
      await new Promise(resolve => setTimeout(resolve, 40));
      return original(...args);
    });
    const results = await Promise.all(Array.from({ length: 8 }, () => postEvent().expect(200)));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(results.every(result => JSON.stringify(result.body) === JSON.stringify(results[0].body))).toBe(true);
  });

  it('allows a failed delivery to be retried', async () => {
    jest.spyOn(app.get(PolicyService), 'ask').mockRejectedValueOnce(new Error('temporary failure'));
    await postEvent().expect(500);
    await postEvent().expect(200);
  });

  it('mocks the optional LLM adapter without any paid request', async () => {
    process.env.ANTHROPIC_API_KEY = 'synthetic-test-key';
    const adapter = jest.spyOn(app.get(LlmAdapter), 'answer').mockResolvedValue('Mocked answer [motor:p1:c1]');
    const result = await request(app.getHttpServer()).post('/ask').send({ question: 'Windscreen?' }).expect(201);
    expect(result.body.mode).toBe('llm');
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the index when the ingest service fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await upload().expect(502);
    const result = await request(app.getHttpServer()).post('/ask').send({ question: 'Windscreen?' });
    expect(result.body.citations[0].doc_id).toBe('motor');
  });
});
