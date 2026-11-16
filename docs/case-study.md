# Case study: a synthetic broker's policy desk

Author: Abdelrhman Shalby

## Problem and constraints

This forward-deployed engineering exercise models a fictional broker whose staff need to find policy clauses and connect CRM questions to cited answers. It is a portfolio demo using entirely synthetic documents, not a client engagement. There are no production users, traffic or business-impact measurements.

The implementation extends a small Python ingestion service and TypeScript/NestJS backend. Constraints were local reproducibility, English/Arabic documents, page references, no vector service, and no paid API calls during development verification or CI. The work builds on backend experience with Node.js/TypeScript, Laravel, payments, idempotency and distributed systems; it does not claim insurance-domain deployment experience.

## What was built

FastAPI extracts text and page-aware chunks. NestJS persists a lexical index, serves a small accessible static demo and answers questions with source title, page and passage. A signed CRM endpoint stores and replays results through a selectable memory/Redis abstraction. Docker Compose, two OS launchers, automated tests and an extractive evaluation provide a reproducible handoff.

## Decisions and trade-offs

- **Lexical retrieval over embeddings:** MiniSearch keeps the demo local, inexpensive and inspectable. Arabic normalization fixes spelling/prefix mismatches without adding a dependency. It still misses semantic paraphrases and cannot handle scanned PDFs without OCR.
- **Extractive fallback:** Questions work without credentials or paid calls. The answer quotes matching passages and abstains when retrieval is weak. Source selection is evaluated; extracted relevance still needs human review. An optional LLM adapter remains mocked during tests.
- **HMAC plus idempotency:** Raw-byte signatures authenticate CRM delivery; stable event IDs suppress retry computation. Neither mechanism authorizes human users or limits replay age. A changed payload with the same ID receives the first stored result.
- **Redis claim pattern:** Atomic SET NX with expiry coordinates two API instances. Results are stored as JSON; owner-checked completion/release prevents stale workers corrupting newer claims. Duplicates wait briefly or return 409 processing. Seven-day retention is explicit; crashed claims can remain pending until expiry. Index writes still require a single writer per directory.
- **Small delivery surface:** A no-framework UI and standard-library Python smoke/eval keep setup modest. No cloud, deployment pipeline or external vector infrastructure was introduced.

## Measured results

The actual 2026-11-16 local extractive run recorded 22/22 answerable retrieval hits at k=3 (100%), Arabic 8/8, English 14/14, and unknown-question abstention 2/2 (100%). Average response latency was 2.07 ms on this small local fixture. Phase one was 16/17 (94.1%) overall; its Arabic prefix miss now hits. Five Arabic questions were added. These are fixture results, not general retrieval quality or production latency claims. See `eval/results.md` for the full run.

Python passed five tests with warnings treated as errors. API tests passed 24 checks including Arabic normalization, both stores, cross-instance duplicate handling through a shared fake Redis, pending timeout and the static UI route. The production npm audit reported zero vulnerabilities; 20 development advisories remain (4 low, 16 moderate). Compose configuration validates. Browser interaction and container execution were not verified in this environment; details are in `docs/verification.md`. Nothing was deployed or published by the implementer.

## Next steps for a real installation

First agree document versions, insurance-review ownership, languages, privacy and retention with the client. Add restricted TLS access, user/tenant authorization, rate limits and audit logs before network exposure. Evaluate realistic paraphrases and difficult unknown questions, review citations against source pages, and benchmark under representative load. Decide whether OCR or semantic retrieval is justified by measured misses.

Then validate real Redis persistence/failover, index replication or a single-writer ingestion design, and recovery drills. Add input hashes, replay-age limits and renewable claims where processing duration requires them. Evaluate any paid model only after data-sharing and cost approval. Delivery success would be measured against agreed reviewer-verified answers and operational recovery criteria, rather than inferred from this demo fixture.
