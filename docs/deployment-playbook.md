# One-day client installation playbook

This is a local portfolio reference using synthetic documents. No client installation or deployment has been performed. Production rollout requires client approval, approved hosting and access controls.

## 09:00 — Confirm scope and prerequisites

Identify a technical contact and an insurance reviewer. Agree document versions, languages, retention, data location and questions that must abstain. Install Python 3.12+ and Node 20.19+. Reserve localhost ports 8001 and 3000, a writable persistent index directory and a process supervisor. Start in extractive mode without a paid API key.

Place TLS and authentication at a restricted reverse proxy before any network exposure. `/documents` and `/ask` have no built-in user authentication; do not expose them directly. Keep ingest private.

## 10:00 — Install and configure

Run the README installation and tests. API variables: `PORT`, `INGEST_URL`, `INDEX_PATH`, `CRM_WEBHOOK_SECRET`, optional `ANTHROPIC_API_KEY`. Use `.env.example` as a template, never commit environment files. Start ingest using `uvicorn main:app --host 127.0.0.1 --port 8001`; the CLI flag controls its port.

Mount the index on persistent storage with restricted permissions and take an approved backup before replacing documents. Run one API process per index. Verify both `/health` routes. Health indicates responsiveness, not index freshness or upstream readiness.

## 11:00 — Load approved documents

Check approval and text extraction first. Upload each document with a stable `doc_id` and human-readable title. Reusing its ID replaces all previous chunks. Text must be UTF-8; PDFs retain page numbers. Files above 10 MB and scanned PDFs without text are rejected. OCR is outside this phase.

Have the insurance reviewer verify known questions, exclusions and unknown questions in each language. Open every cited page. Lexical retrieval misses some paraphrases; extracted answers are review aids, not binding coverage decisions.

## 13:00 — Connect the CRM

Exchange a strong secret through an approved secret channel. Set `CRM_WEBHOOK_SECRET` at both ends without logging it. Send UTF-8 JSON `{event_id, case_id, customer_question}` and header `X-Signature: sha256=<hex HMAC-SHA256>` over the exact transmitted body bytes. Changing whitespace invalidates the signature.

Use one stable unique event ID per logical question. Retry timeouts and 5xx with exponential backoff and jitter using the same ID and body. Fix configuration/payload errors before retrying 400 or 401. First successful result wins even if an ID is reused with changed content. Failed computations are removed for retry.

Demo results live in memory until restart; the map has no retention limit. Before production use a durable event-result store and agreed retention. For multiple instances acquire Redis `SET event:<id> processing NX EX <lease>`, persist completion durably, and let duplicates wait/read it. Renew leases and verify lock ownership to prevent stale workers publishing. Store an input hash to detect ID misuse. Add replay-age checks separately: this demo accepts valid captured signatures indefinitely.

## 15:00 — Verify and monitor

Run the README synthetic walkthrough on an isolated index. Then test approved documents: cited answer, unknown question, invalid signature, exact replay, concurrent duplicates, re-ingestion and restart. Record versions, document IDs and reviewer approval. Eval checks document/page retrieval and not-found responses, not generated answer correctness.

Monitor request volume, latency, 4xx/5xx, upload rejection, ingest timeout, index write failures, disk space and duplicate/lock counts. Add redacted structured request logs for production; never log raw documents or secrets.

## 16:00 — Handoff and rollback

Record owners, escalation contacts, update cadence, limitations and rollback approval. Keep the previous application and approved index snapshot. If a release fails, pause CRM retries, stop the index writer, restore the matching application and snapshot, restart, verify citations, then resume traffic. Do not delete backups during rollback. Restart loses demo webhook deduplication; agree replay handling first. Optional LLM activation needs separate approval for cost, data sharing and model availability.
