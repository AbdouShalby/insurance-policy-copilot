'use strict';

const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { performance } = require('node:perf_hooks');

async function main() {
  const started = performance.now();
  // Exercise the exact deployment export, including compiled Nest imports.
  const handler = require('./api/index');
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const result = await fetch(`${base}/ask`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is the excess for windscreen damage?' }) });
    assert.equal(result.status, 201);
    const body = await result.json();
    assert.equal(body.mode, 'extractive');
    assert(body.citations.some(citation => citation.chunk_id === 'motor:p1:c1'));
    const elapsed = performance.now() - started;
    console.log(body.answer);
    console.log(`Cold first /ask: ${elapsed.toFixed(0)} ms (includes module loading and bootstrap)`);
    assert(elapsed < 3000, 'Local cold first /ask exceeded the 3-second target');
    for (const path of ['/documents', '/samples', '/webhooks/crm']) {
      const blocked = await fetch(base + path, { method: 'POST' });
      assert.equal(blocked.status, 403);
      console.log(`${path}: ${blocked.status}`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
