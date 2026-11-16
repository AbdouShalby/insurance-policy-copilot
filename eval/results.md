# Local evaluation results

Run at: 2026-11-16T14:48:00.985477+00:00

- Retrieval hit rate at k=3 (document and page): 16/17 (94.1%)
- Not-found accuracy (unanswerable questions): 2/2 (100.0%)
- Average latency: 2.91 ms
- Modes: extractive

This small synthetic lexical-retrieval check measures source selection, not answer correctness or production readiness.

| Question | Expected document | Hit | Latency (ms) |
| --- | --- | --- | --- |
| What is the collision deductible? | motor | Yes | 30.25 |
| What is the windscreen repairs limit? | motor | Yes | 2.55 |
| What report do theft claims require? | motor | Yes | 1.79 |
| How far does towing assistance extend? | motor | Yes | 1.33 |
| What is the inpatient hospital treatment limit? | medical | Yes | 1.48 |
| When do planned hospital admissions require pre-authorisation? | medical | Yes | 1.63 |
| What is the dental treatment limit? | medical | Yes | 1.52 |
| What is the maternity waiting period? | medical | Yes | 1.30 |
| What is the maximum duration of trips? | travel | Yes | 1.17 |
| What baggage delay qualifies for essential purchases? | travel | Yes | 1.33 |
| Is visa refusal covered? | travel | Yes | 1.48 |
| How many nights of alternative accommodation are reimbursed? | home | Yes | 1.06 |
| What is the jewellery limit? | home | Yes | 0.97 |
| What is the deductible for water leakage? | home | Yes | 1.09 |
| ما الحد الأقصى لجلسات العلاج الطبيعي؟ | medical-ar | No | 1.34 |
| ما تغطية النظارات الطبية؟ | medical-ar | Yes | 1.13 |
| ما مهلة تقديم المطالبة الطبية؟ | medical-ar | Yes | 1.39 |
| Are cryptocurrency mining rigs insured? | Not found | Yes | 1.26 |
| What benefits exist for lunar tourism? | Not found | Yes | 1.23 |
