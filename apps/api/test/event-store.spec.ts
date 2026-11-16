import { ConflictException } from '@nestjs/common';
import { COMPLETE, EventStore, MemoryEventStore, RedisClient, RedisEventStore } from '../src/event-store';
import { CrmService } from '../src/crm.service';
import { PolicyService } from '../src/policy.service';
class FakeRedis implements RedisClient {
  values = new Map<string, { value: string; expires: number }>();
  async get(key: string) {
    const entry = this.values.get(key);
    if (entry && entry.expires <= Date.now()) { this.values.delete(key); return null; }
    return entry?.value ?? null;
  }
  async set(key: string, value: string, ex: 'EX', ttl: number, nx: 'NX') {
    const current = this.values.get(key);
    if (current && current.expires > Date.now()) return null;
    this.values.set(key, { value, expires: Date.now() + ttl * 1000 }); return 'OK';
  }
  async eval(script: string, count: number, ...args: (string | number)[]) {
    const [key, owner, value, ttl] = args;
    if (await this.get(String(key)) !== owner) return 0;
    if (script === COMPLETE) this.values.set(String(key), { value: String(value), expires: Date.now() + Number(ttl) * 1000 });
    else this.values.delete(String(key));
    return 1;
  }
  async quit() {}
}
for (const name of ['memory', 'redis']) {
  describe(`${name} event store`, () => {
    let store: EventStore;
    beforeEach(() => { store = name === 'memory' ? new MemoryEventStore(1) : new RedisEventStore(new FakeRedis(), 1); });
    it('claims once, stores JSON results and replays without allowing release by another owner', async () => {
      expect(await store.claim('a', 'owner')).toBe(true);
      expect(await store.claim('a', 'other')).toBe(false);
      await store.release('a', 'other');
      await store.complete('a', 'other', { bad: true });
      expect(await store.result('a')).toBeUndefined();
      await store.complete('a', 'owner', { answer: 'done' });
      expect(await store.result('a')).toEqual({ answer: 'done' });
    });
    it('releases failures for retry', async () => {
      await store.claim('a', 'owner'); await store.release('a', 'owner');
      expect(await store.claim('a', 'retry')).toBe(true);
    });
    it('expires claims and prevents stale owners overwriting new work', async () => {
      jest.useFakeTimers();
      try {
        await store.claim('a', 'old'); jest.advanceTimersByTime(1001);
        expect(await store.claim('a', 'new')).toBe(true);
        await store.complete('a', 'old', { stale: true });
        expect(await store.result('a')).toBeUndefined();
        await store.complete('a', 'new', { fresh: true });
        jest.advanceTimersByTime(1001);
        expect(await store.result('a')).toBeUndefined();
      } finally { jest.useRealTimers(); }
    });
  });
}
it('shares claims and stored results across two service instances', async () => {
  const redis = new FakeRedis();
  const policies = { ask: jest.fn(async () => { await new Promise(resolve => setTimeout(resolve, 45)); return { answer: 'done', citations: [], mode: 'extractive' }; }) };
  const first = new CrmService(policies as unknown as PolicyService, new RedisEventStore(redis));
  const second = new CrmService(policies as unknown as PolicyService, new RedisEventStore(redis));
  const event = { event_id: 'cross-instance', case_id: 'case', customer_question: 'Question?' };
  const results = await Promise.all([first.process(event), second.process(event)]);
  expect(results[0]).toEqual(results[1]); expect(policies.ask).toHaveBeenCalledTimes(1);
  expect(await new CrmService(policies as unknown as PolicyService, new RedisEventStore(redis)).process(event)).toEqual(results[0]);
});
it('returns 409 processing when the claim has no result before the bounded deadline', async () => {
  const store = new RedisEventStore(new FakeRedis()); await store.claim('busy', 'other');
  const policies = { ask: jest.fn() };
  const service = new CrmService(policies as unknown as PolicyService, store);
  await expect(service.process({ event_id: 'busy', case_id: 'case', customer_question: 'Question?' })).rejects.toThrow(ConflictException);
  expect(policies.ask).not.toHaveBeenCalled();
});
it('bounds duplicate waiting even when a store read never resolves', async () => {
  const store = new MemoryEventStore();
  await store.claim('stalled', 'other');
  jest.spyOn(store, 'result').mockImplementation(() => new Promise(() => {}));
  const service = new CrmService({ ask: jest.fn() } as unknown as PolicyService, store);
  await expect(service.process({ event_id: 'stalled', case_id: 'case', customer_question: 'Question?' }))
    .rejects.toThrow(ConflictException);
});
