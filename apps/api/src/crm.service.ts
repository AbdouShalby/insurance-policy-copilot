import { Injectable } from '@nestjs/common';
import { CrmDto } from './dto';
import { PolicyService } from './policy.service';
import { Answer } from './types';

interface CrmResult extends Answer { event_id: string; case_id: string; }

@Injectable()
export class CrmService {
  private readonly events = new Map<string, Promise<CrmResult>>();
  constructor(private readonly policies: PolicyService) {}

  process(event: CrmDto): Promise<CrmResult> {
    const existing = this.events.get(event.event_id);
    if (existing) return existing;
    // Install the shared promise synchronously, before any question processing begins.
    const pending = Promise.resolve().then(async () => ({
      ...await this.policies.ask(event.customer_question), event_id: event.event_id, case_id: event.case_id,
    }));
    this.events.set(event.event_id, pending);
    void pending.catch(() => this.events.delete(event.event_id));
    return pending;
  }
}
