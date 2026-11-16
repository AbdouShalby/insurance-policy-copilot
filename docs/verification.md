# Verification evidence

Verified by Codex on 2026-11-16 in Windows PowerShell, Python 3.14.5 and Node 24.15.0. Changes are built and locally verified where explicitly listed. No staging, commit, push, merge, deployment, real-data migration or paid model call was performed. Claude retains review/publication ownership.

## Phase two automated checks

| Check | Result |
| --- | --- |
| In `services/ingest`: `.venv/Scripts/python -m pytest -q -W error` | Exit 0; five tests, no warnings. Tests use existing httpx ASGITransport directly instead of deprecated Starlette TestClient integration. |
| In `apps/api`: `npm.cmd test` | Exit 0; 24 tests across three suites. |
| In `apps/api`: `npm.cmd run build` | Exit 0; TypeScript compilation passed. |
| In `apps/api`: `npm.cmd audit --omit=dev --cache ../../.cache/npm` | Exit 0; zero production vulnerabilities. |
| In `apps/api`: `npm.cmd audit --cache ../../.cache/npm` | Exit 1; 20 development advisories, 4 low and 16 moderate after a non-breaking audit fix. |
| `docker compose config --quiet` | Exit 0 with a temporary empty Docker config directory and synthetic shell secret; containers were not started. |
| CI workflow parsed with installed `js-yaml` | Exit 0; valid YAML with push/pull_request trigger and verification job. Hosted GitHub Actions was not run. |
| PowerShell parser and `bash -n scripts/start-local.sh` | Exit 0; launchers are syntactically valid. Native launcher lifecycle was not separately exercised on both OSes. |
| `git diff --check` | Exit 0; no whitespace errors. |

API tests cover the static HTML route and real sample-file loading through mocked ingest, Arabic orthographic normalization and prefixes, unchanged English tokenization, both event stores, result replay, release/retry, TTL expiration, stale owner rejection, two CrmService instances sharing fake Redis, restart-like result replay, and bounded 409 processing, including a store read that never resolves. Existing retrieval, validation, HMAC, concurrent delivery, failed retry, index persistence and mocked LLM tests remain green. The fake models atomic SET/expiry and owned completion; it is not evidence of real Redis integration or failover.

### Remaining development advisories

Low: `deepmerge`, `jest`, `jest-cli`, `ts-jest`.

Moderate: `@jest/core`, `@jest/expect`, `@jest/globals`, `@jest/reporters`, `@jest/transform`, `babel-jest`, `babel-plugin-istanbul`, `glob`, `jest-circus`, `jest-config`, `jest-resolve-dependencies`, `jest-runner`, `jest-runtime`, `jest-snapshot`, `minimatch`, `test-exclude`.

`npm audit fix` applied its available non-breaking update but did not clear these findings. npm proposes a breaking Jest downgrade for full remediation; it was not applied. Root advisories concern deepmerge prototype poisoning and glob/minimatch traversal or denial-of-service behavior. They remain confined to development tooling.

## End-to-end and evaluation

Owned isolated services were started on ingest 18003 and API 13002 with a synthetic HMAC secret, empty LLM key/Redis URL, and `INDEX_PATH=data/index/fde002-verification.json`. Existing services were not stopped or modified.

- `services/ingest/.venv/Scripts/python scripts/smoke.py --api-url http://127.0.0.1:13002`: exit 0. Loaded all five synthetic policies, returned the EGP 5000 windscreen answer with citations, delivered a valid signed CRM event and replayed its identical result.
- `services/ingest/.venv/Scripts/python eval/run-eval.py --api-url http://127.0.0.1:13002`: exit 0; wrote `eval/results.md`. Overall hit@3 22/22 (100%); Arabic 8/8 (100%); English 14/14 (100%); not-found accuracy 2/2 (100%). Average latency 2.07 ms, all responses extractive. All answerable Arabic questions hit.
- The evaluation now exits nonzero below 0.85 overall retrieval, below 1.0 abstention, or for any non-extractive response. CI uses those same gates.

No paid requests were made. Local environment versions differ from the CI targets (Python 3.12 / Node 20); that target runtime run remains pending hosted CI. The eval measures expected source document/page selection, not answer correctness or production latency.

## UI verification boundary

The UI route is tested through HTTP, its loader is covered through mocked ingest, and a final live local HTTP check returned the demo HTML and loaded all five samples through POST /samples. The static page includes a labeled question field, status announcements, disabled loading controls, errors, empty sources, citations, mode badge, Arabic RTL detection and responsive CSS with no external assets.

Manual rendered checking of load -> ask -> citations -> Arabic RTL could not be completed. The in-app browser returned `The browser access host is unavailable`. Native Chrome access then returned `user input was detected in this window; call get_window_state before continuing`, including after refreshing window state. No local application screenshot or phone-width rendering was verified. Console health and visible RTL/layout therefore remain unverified. Do not treat HTTP/UI-route tests as browser proof; Claude must complete that acceptance item before calling the contract fully done.

## Phase one baseline

Phase one recorded five Python tests, 11 API tests, a successful build and signed smoke/replay on isolated ports. Its 19-question eval had 16/17 answerable retrieval hits (94.1%) and 2/2 correct not-found responses. The missed Arabic physical-therapy question used a prefix mismatch. Phase-two normalization resolves it and adds five Arabic cases. The phase-one Starlette/httpx deprecation warning is resolved in phase-two tests without adding a Python dependency.

## Delivery limits

Compose syntax is verified; image builds and running containers/real Redis are not. CI is authored and locally syntax/command checked, not executed on GitHub. Native launchers were syntax checked, not fully lifecycle-tested on Linux/macOS. The UI manual check remains blocked by computer-access tooling. No deployment or publication is included. The lead's required employer/client-name publication scan remains with the lead. Working-tree review excludes environment/auth files; no secret values were added to the changes.

## Lead browser check (2026-11-16)

Run by the lead in headless Chromium against a local build (API on 13101, ingest on 18101, extractive mode):
- Desktop 1280px: sample loading, English question, answer with citation (motor policy, page 1). No console errors, no horizontal scroll.
- Phone 390px: Arabic question "كم نسبة تحمل الكشف الطبي؟" returned the Arabic medical policy (page 1) rendered right-to-left. No console errors, no horizontal scroll.
- Fix applied during the check: the answer block direction now follows the answer text only, so an English "not found" message is no longer rendered right-to-left after an Arabic question.
- Fixed after the check: extractive answers no longer start with the markdown heading and repeated title of the source chunk (`readableText`, covered by tests).
