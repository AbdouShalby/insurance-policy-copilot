# One-day installation playbook

This is a synthetic portfolio reference, not a completed client deployment. Use only approved fictional data during local verification. Production installation, data changes and paid-model activation require separate approval.

## 09:00 - Agree scope and prerequisites

Identify a technical owner and insurance reviewer. Agree languages, document versions, tenant boundaries, retention, data location and abstention examples. Requirements: Docker Compose v2, or Python 3.12+ / Node 20.19+ for native startup. Default ports are API 3000 and ingest 8001. Use restricted TLS access and authentication before network exposure; keep ingest and Redis private. UI, ask, upload and sample loading have no built-in user authentication.

## 10:00 - Install and configure

Follow the README quick start and tests. `docker compose up --build` runs ingest, API and Redis with healthchecks. Set `CRM_WEBHOOK_SECRET` in the shell first. API uses Redis in compose, and named volumes retain the source index and Redis append-only data. Only API port 3000 is published on localhost. `docker compose config --quiet` validates the resolved configuration; a valid file does not prove containers run successfully.

Without Docker, install requirements and npm dependencies, then use `scripts/start-local.ps1` or `bash scripts/start-local.sh`. These launch both services, force extractive mode and load synthetic samples. An external `REDIS_URL` selects Redis; otherwise event results are in memory. Do not use sample loading against a real document collection: it replaces the five known sample IDs.

Review `apps/api/.env.example` and the README configuration table: `HOST`, `PORT`, `INGEST_URL`, `INDEX_PATH`, `CRM_WEBHOOK_SECRET`, `REDIS_URL`, `CRM_EVENT_TTL_SECONDS`, optional `ANTHROPIC_API_KEY`. The bash launcher also accepts `INGEST_PORT`. The ingest listen port is a uvicorn CLI flag. Shell variables are inherited; `.env` files are not automatically loaded. Default CRM retention is 604800 seconds (seven days).

Use one API index writer per index directory. Multiple instances need independently synchronized indexes or a revised ingestion design; Redis deduplication alone does not make filesystem writes distributed. Back up an approved index before replacement. Check both health routes; API health reports responsiveness, not Redis connectivity or document freshness.

## 11:00 - Load reviewed documents

Use `POST /documents` with multipart `file`, stable `doc_id` and `title`. Reusing the ID replaces all its chunks. UTF-8 text uses page 1; PDFs retain source pages. Files above 10 MB, unsupported files and documents without extracted text are rejected. OCR is outside this demo.

For the local demo only, open `/`, load samples, ask English/Arabic questions and inspect titles/pages/snippets. Verify expected and unsupported questions in each language against the actual source. The fixture's 100% retrieval result does not establish answer correctness for client documents.

## 13:00 - Connect CRM with retries

Exchange a strong secret via an approved secret channel. Send UTF-8 JSON `{event_id, case_id, customer_question}` with `X-Signature: sha256=<hex HMAC-SHA256>`, signing the exact transmitted bytes. Invalid signatures return 401 before processing. Keep a stable unique event ID and identical payload across retries.

Memory mode loses results on restart. With Redis, atomic `SET ... EX ttl NX` claims an event, owner-checked Lua stores JSON results, and completion refreshes retention. Two API instances sharing Redis cannot both acquire an unexpired claim. A duplicate waits up to one second, reading every 25 ms; it returns the stored result or 409 `processing`. Retry 409, timeouts and 5xx with exponential backoff and jitter. Correct 400/401 before retrying. A failed computation releases its owned claim; a crashed worker can leave processing until expiry. A late worker cannot overwrite a newer claim.

Agree TTL relative to worst-case processing and business replay expectations. There is no renewal, payload-hash conflict detection, replay-age validation or exactly-once external side effect guarantee. First completed result wins within retention even if an ID is reused with changed content. Redis persistence needs recovery testing; append-only storage reduces restart loss but is not a zero-loss guarantee.

## 15:00 - Verify and monitor

Run Python/API tests, build, smoke and eval from the README on an isolated index. Test citations, unknown questions, invalid HMAC, exact/concurrent replay, pending 409, failed-work retry, re-ingestion, API restart and Redis restart recovery. Unit concurrency tests use an in-process fake; real Redis and failover need separate verification. CI has no deployment steps and uses extractive mode only.

Monitor latency, errors, ingest failures, index age/writes, disk space, Redis connectivity/memory/eviction, pending claims and duplicate rates. Add redacted structured logs without raw policy text or secrets. Record application versions, document versions and reviewer approvals.

## 16:00 - Handoff and rollback

Document owners, limitations, escalation and rollback approval. Preserve the previous application/index snapshot and approved Redis backups. For rollback, pause CRM retries, stop the index writer, restore matching application/snapshot, restart, verify sources and event replay, then resume traffic. `docker compose down` preserves named volumes; do not remove data volumes as a rollback shortcut. Memory-mode restart loses deduplication. A Redis format/retention change requires compatibility review before rollout.

Paid model activation needs separate cost/data-sharing approval and live availability checks. No production installation, remote deployment or real-data change was performed under this task.
