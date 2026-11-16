# FDE-001 local verification

Verified by Codex on 2026-11-16, Windows PowerShell, Python 3.14.5 and Node 24.15.0. Built and locally verified only; no staging, commit, push, merge, deployment or real client data changes.

## Automated checks

- In `services/ingest`: `.venv\Scripts\python -m pytest -q` — exit 0, 5 tests passed. Covers bounded sentence chunks and overlap, long sentences, Arabic detection, generated two-page PDF extraction, unsupported/empty/invalid/oversized uploads and health.
- In `apps/api`: `npm.cmd test` — exit 0, 11 tests passed. Covers cited extractive answers, sentence relevance, abstention, replacing/reloading an index, validation, invalid signatures, successful CRM delivery, replay, eight concurrent duplicates, retry after failure, mocked LLM and ingest failure preservation.
- `npm.cmd run build` — exit 0, no TypeScript errors.
- `npm.cmd audit --omit=dev --cache ../../.cache/npm` — exit 0, no production dependency vulnerabilities reported. The final lockfile refresh reported 20 advisories (4 low, 16 moderate), confined to development dependencies; no automatic dependency upgrades were applied.

## End-to-end checks

Default ports 8001 and 3000 were already occupied. Fresh isolated test processes were started on ingest 18001 and API 13000, with explicit `INGEST_URL`, a separate local index and a synthetic CRM secret. No existing listener was stopped. Application defaults remain 8001 and 3000.

The owned test processes were stopped after verification. The ignored synthetic index was retained for review; the temporary npm download cache was removed.

- `scripts/smoke.py --api-url http://127.0.0.1:13000` — exit 0. Loaded all five synthetic policies, checked an extractive answer containing EGP 5000 with a motor citation, delivered a correctly signed CRM request and compared its replay with the original result.
- Executed the README PowerShell curl block with only base URLs substituted to the test ports — exit 0. Both health calls returned 200, upload and question succeeded, and signed webhook/replay returned identical results.
- `eval/run-eval.py --api-url http://127.0.0.1:13000` — exit 0, wrote `eval/results.md`. Retrieval hit rate at k=3: 16/17 (94.1%); not-found accuracy: 2/2 (100%); average latency: 2.91 ms. Extractive mode throughout.

The missed Arabic question uses a prefixed form of a word that differs from the document's token. The simple tokenizer has no Arabic morphological analysis. No model calls were made. Live availability of the contract-specified Anthropic model remains unverified. Eval measures source document/page selection, not answer correctness.

Python tests emitted a Starlette deprecation warning about the allowed `httpx` test client. Tests passed; no unapproved replacement dependency was added.

## Known boundaries

Single-process index writes and in-memory webhook deduplication are intentional phase-one limits. Restart loses webhook results. The README and deployment playbook describe durable/multi-instance handling, authentication, replay-age controls, monitoring and rollback work needed before client production use. No frontend was requested or built.
