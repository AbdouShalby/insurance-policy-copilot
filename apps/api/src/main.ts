import { createApp } from './app';

async function main(): Promise<void> {
  const app = await createApp();
  await app.listen(Number(process.env.PORT || 3000), process.env.HOST || '127.0.0.1');
  console.log(`Policy API listening on http://127.0.0.1:${process.env.PORT || 3000}`);
}

void main().catch(() => { console.error('API failed to start; check index integrity and port configuration.'); process.exitCode = 1; });
