import { createApp, seedSamples } from './app';
import { PolicyService } from './policy.service';

async function main(): Promise<void> {
  const app = await createApp();
  if (process.env.SEED_SAMPLES_ON_START === 'true') {
    try { await seedSamples(app.get(PolicyService)); }
    catch (error) { await app.close(); throw error; }
  }
  await app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
  console.log(`Policy API listening on http://127.0.0.1:${process.env.PORT || 3000}`);
}

void main().catch(() => { console.error('API failed to start; check index integrity and port configuration.'); process.exitCode = 1; });
