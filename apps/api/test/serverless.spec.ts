import { INestApplication } from '@nestjs/common';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { IndexStore } from '../src/index-store';

const { createHandler } = require('../../../deploy/vercel/handler');
const snapshot = join(__dirname, '../../../deploy/vercel/demo-index.json');

describe('Vercel read-only function', () => {
  let previous: NodeJS.ProcessEnv;
  let directory: string;
  let app: INestApplication | undefined;
  let bootstrap: jest.Mock;

  beforeEach(async () => {
    previous = { ...process.env };
    directory = await mkdtemp(join(tmpdir(), 'policy-serverless-'));
    // These must never activate an outbound service in the serverless entry.
    process.env.ANTHROPIC_API_KEY = 'synthetic-test-value';
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    process.env.DEMO_MODE = 'false';
    bootstrap = jest.fn(async () => { app = await createApp(); return app; });
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('No network services allowed'));
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    jest.restoreAllMocks();
    process.env = previous;
    await rm(directory, { recursive: true, force: true });
  });

  it('shares one cold bootstrap and answers English, Arabic and not-found questions without writes', async () => {
    const before = await readFile(snapshot);
    const handler = createHandler({ indexPath: snapshot, bootstrap });
    const [english, arabic] = await Promise.all([
      request(handler).post('/ask').send({ question: 'What is the excess for windscreen damage?' }).expect(201),
      request(handler).post('/ask').send({ question: 'كم نسبة تحمل الكشف الطبي؟' }).expect(201),
    ]);
    expect(bootstrap).toHaveBeenCalledTimes(1);
    expect(english.body.mode).toBe('extractive');
    expect(english.body.citations).toEqual(expect.arrayContaining([expect.objectContaining({ chunk_id: 'motor:p1:c1' })]));
    expect(arabic.body.mode).toBe('extractive');
    expect(arabic.body.citations).toEqual(expect.arrayContaining([expect.objectContaining({ doc_id: 'medical-ar' })]));
    const unknown = await request(handler).post('/ask')
      .send({ question: 'Does the travel policy cover space tourism flights?' }).expect(201);
    expect(unknown.body.citations).toEqual([]);
    expect(unknown.body.answer).toBe('Not found in the policy documents.');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await readFile(snapshot)).toEqual(before);
  });

  it('serves the existing guarded UI, health and blocked routes through the function', async () => {
    const handler = createHandler({ indexPath: snapshot, bootstrap });
    const page = await request(handler).get('/').expect(200);
    expect(page.text).toContain('<section aria-labelledby="setup" hidden>');
    expect(page.text).toContain('read-only');
    expect(page.text).not.toContain('type="file"');
    await request(handler).get('/health').expect(200, { status: 'ok' });
    for (const path of ['/documents', '/samples', '/webhooks/crm']) {
      await request(handler).post(path).send({}).expect(403);
    }
    for (let i = 0; i < 20; i++) {
      await request(handler).post('/ask').set('X-Forwarded-For', '198.51.100.1')
        .send({ question: 'Windscreen?' }).expect(201);
    }
    await request(handler).post('/ask').set('X-Forwarded-For', '198.51.100.1')
      .send({ question: 'Windscreen?' }).expect(429);
  });

  it.each(['missing', 'json', 'schema', 'duplicate'])('returns stable JSON 503 for a %s snapshot', async kind => {
    const indexPath = join(directory, 'index.json');
    if (kind === 'json') await writeFile(indexPath, '{broken');
    if (kind === 'schema') await writeFile(indexPath, JSON.stringify({ version: 1, chunks: [{}] }));
    if (kind === 'duplicate') {
      const saved = JSON.parse(await readFile(snapshot, 'utf8'));
      saved.chunks.push(saved.chunks[0]);
      await writeFile(indexPath, JSON.stringify(saved));
    }
    const handler = createHandler({ indexPath, bootstrap });
    for (let i = 0; i < 2; i++) {
      const result = await request(handler).get('/health').expect(503).expect('Content-Type', /json/);
      expect(result.body.error.message).toContain('read-only policy index');
    }
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it('rejects internal replacement as well as public mutation routes', async () => {
    const store = new IndexStore(snapshot, true);
    await store.load();
    await expect(store.replace('motor', [])).rejects.toThrow('Index is read-only');
  });
});
