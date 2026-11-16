# Changelog

## 0.2.0 - 2026-11-16

- Added Arabic orthographic normalization and light prefix stripping to indexing and queries.
- Added configurable memory/Redis event stores, atomic owned claims, stored-result replay and bounded duplicate waits.
- Added a standalone demo UI, sample loader endpoint and native OS launchers.
- Added Dockerfiles, Redis-backed Compose healthchecks/persistent volumes, and non-deploying tests/build/eval CI.
- Expanded evaluation to 24 questions with per-language rates and failing quality gates.
- Removed the test-client deprecation warning by using the existing httpx ASGI transport directly.
- Added architecture, case study, verification and installation documentation, plus MIT licensing.

## 0.1.0 - 2026-11-16

- Built stateless Python PDF/text ingestion with bounded page-aware chunks.
- Built NestJS lexical retrieval, atomic index snapshots, cited extractive answers and a mocked optional LLM adapter.
- Added raw-body HMAC CRM delivery with process-local deduplication.
- Added five synthetic policies, tests, smoke script and the original 19-question evaluation.
