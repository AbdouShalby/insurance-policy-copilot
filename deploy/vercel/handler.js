'use strict';

const { join } = require('node:path');

// Factory keeps tests isolated. The deployed entry creates exactly one cached promise.
function createHandler({ indexPath = join(__dirname, 'demo-index.json'), bootstrap } = {}) {
  let application;
  async function start() {
    process.env.DEMO_MODE = 'true';
    process.env.INDEX_READ_ONLY = 'true';
    process.env.INDEX_PATH = indexPath;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.REDIS_URL;
    delete process.env.SEED_SAMPLES_ON_START;
    const createApp = bootstrap || require('../../apps/api/dist/app').createApp;
    const app = await createApp();
    return app.getHttpAdapter().getInstance();
  }
  return async function handler(request, response) {
    let listener;
    try {
      application ||= start();
      listener = await application;
    } catch {
      // Cache failure as well: a broken deployment fails clearly without a retry loop.
      response.statusCode = 503;
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      response.end(JSON.stringify({ statusCode: 503,
        error: { message: 'Public demo unavailable: unable to load the read-only policy index.' } }));
      return;
    }
    listener(request, response);
  };
}

module.exports = { createHandler };
