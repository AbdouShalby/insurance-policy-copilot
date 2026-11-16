import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
export interface EventStore {
  claim(id: string, owner: string): Promise<boolean>;
  result<T>(id: string): Promise<T | undefined>;
  complete(id: string, owner: string, result: unknown): Promise<void>;
  release(id: string, owner: string): Promise<void>;
  close(): Promise<void>;
}
export class MemoryEventStore implements EventStore {
  private events = new Map<string, { owner: string; expires: number; result?: unknown }>();
  constructor(private readonly ttl = 604800) {}
  private entry(id: string) {
    const entry = this.events.get(id);
    if (entry && entry.expires <= Date.now()) { this.events.delete(id); return undefined; }
    return entry;
  }
  async claim(id: string, owner: string) {
    if (this.entry(id)) return false;
    this.events.set(id, { owner, expires: Date.now() + this.ttl * 1000 }); return true;
  }
  async result<T>(id: string): Promise<T | undefined> { return this.entry(id)?.result as T | undefined; }
  async complete(id: string, owner: string, result: unknown) {
    if (this.entry(id)?.owner === owner) this.events.set(id, { owner, result, expires: Date.now() + this.ttl * 1000 });
  }
  async release(id: string, owner: string) { if (this.entry(id)?.owner === owner) this.events.delete(id); }
  async close() {}
}
export interface RedisClient {
  set(key: string, value: string, ex: 'EX', ttl: number, nx: 'NX'): Promise<unknown>;
  get(key: string): Promise<string | null>;
  eval(script: string, keys: number, ...args: (string | number)[]): Promise<unknown>;
  quit(): Promise<unknown>;
}
// Compare ownership atomically so expired workers cannot overwrite newer claims.
export const COMPLETE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3]) end return 0";
export const RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
export class RedisEventStore implements EventStore {
  constructor(private readonly redis: RedisClient, private readonly ttl = 604800) {}
  private key(id: string) { return `crm:event:${id}`; }
  async claim(id: string, owner: string) {
    return await this.redis.set(this.key(id), JSON.stringify({ owner }), 'EX', this.ttl, 'NX') === 'OK';
  }
  async result<T>(id: string): Promise<T | undefined> {
    const value = await this.redis.get(this.key(id));
    return value ? (JSON.parse(value) as { result?: T }).result : undefined;
  }
  async complete(id: string, owner: string, result: unknown) {
    await this.redis.eval(COMPLETE, 1, this.key(id), JSON.stringify({ owner }), JSON.stringify({ result }), this.ttl);
  }
  async release(id: string, owner: string) {
    await this.redis.eval(RELEASE, 1, this.key(id), JSON.stringify({ owner }));
  }
  async close() { await this.redis.quit(); }
}
export function createEventStore(): EventStore {
  const ttl = Number(process.env.CRM_EVENT_TTL_SECONDS || 604800);
  if (!Number.isInteger(ttl) || ttl < 1) throw new Error('CRM_EVENT_TTL_SECONDS must be a positive integer');
  return process.env.REDIS_URL
    ? new RedisEventStore(new Redis(process.env.REDIS_URL, { connectTimeout: 1000, commandTimeout: 1000, maxRetriesPerRequest: 1 }), ttl)
    : new MemoryEventStore(ttl);
}
export const eventOwner = randomUUID;
