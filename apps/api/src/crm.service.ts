import { ConflictException, Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { CrmDto } from './dto';
import { PolicyService } from './policy.service';
import { Answer } from './types';
import { EventStore, eventOwner } from './event-store';
import { clearTimeout, setTimeout } from 'node:timers';
interface CrmResult extends Answer { event_id: string; case_id: string; }
@Injectable()
export class CrmService implements OnModuleDestroy {
  constructor(private readonly policies: PolicyService, @Inject('EventStore') private readonly events: EventStore) {}
  async process(event: CrmDto): Promise<CrmResult> {
    const owner = eventOwner();
    if (await this.events.claim(event.event_id, owner)) {
      try {
        const result = { ...await this.policies.ask(event.customer_question), event_id: event.event_id, case_id: event.case_id };
        await this.events.complete(event.event_id, owner, result); return result;
      } catch (error) { await this.events.release(event.event_id, owner); throw error; }
    }
    const deadline = Date.now() + 1000;
    do {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        this.events.result<CrmResult>(event.event_id),
        new Promise<undefined>(resolve => { timeout = setTimeout(() => resolve(undefined), Math.max(0, deadline - Date.now())); }),
      ]).finally(() => clearTimeout(timeout));
      if (result) return result;
      if (Date.now() >= deadline) break;
      await new Promise(resolve => setTimeout(resolve, 25));
    } while (Date.now() < deadline);
    throw new ConflictException('processing');
  }
  async onModuleDestroy() { await this.events.close(); }
}
