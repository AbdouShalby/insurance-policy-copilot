# Local evaluation results

Run at: 2026-11-16T16:01:41.705153+00:00

- Retrieval hit rate at k=3 (document and page): 22/22 (100.0%)
- Not-found accuracy (unanswerable questions): 2/2 (100.0%)
- Arabic hit@3: 8/8 (100.0%)
- English hit@3: 14/14 (100.0%)
- Average latency: 2.07 ms
- Modes: extractive

This small synthetic lexical-retrieval check measures source selection, not answer correctness or production readiness.

| Question | Expected document | Hit | Latency (ms) |
| --- | --- | --- | --- |
| كم نسبة تحمل الكشف الطبي؟ | medical-ar | Yes | 26.41 |
| هل تشمل التغطية المكملات الغذائية؟ | medical-ar | Yes | 1.53 |
| ما الأوراق المطلوبة للمطالبة الطبية؟ | medical-ar | Yes | 1.15 |
| ما حد تَغْطِيَة النـظارات الطبية؟ | medical-ar | Yes | 1.09 |
| هل الاستشارات الهاتفية متاحة طوال اليوم؟ | medical-ar | Yes | 1.00 |
| What is the collision deductible? | motor | Yes | 1.10 |
| What is the windscreen repairs limit? | motor | Yes | 1.00 |
| What report do theft claims require? | motor | Yes | 1.00 |
| How far does towing assistance extend? | motor | Yes | 0.93 |
| What is the inpatient hospital treatment limit? | medical | Yes | 0.96 |
| When do planned hospital admissions require pre-authorisation? | medical | Yes | 0.94 |
| What is the dental treatment limit? | medical | Yes | 1.20 |
| What is the maternity waiting period? | medical | Yes | 0.96 |
| What is the maximum duration of trips? | travel | Yes | 0.88 |
| What baggage delay qualifies for essential purchases? | travel | Yes | 0.92 |
| Is visa refusal covered? | travel | Yes | 0.92 |
| How many nights of alternative accommodation are reimbursed? | home | Yes | 0.96 |
| What is the jewellery limit? | home | Yes | 0.89 |
| What is the deductible for water leakage? | home | Yes | 0.96 |
| ما الحد الأقصى لجلسات العلاج الطبيعي؟ | medical-ar | Yes | 1.02 |
| ما تغطية النظارات الطبية؟ | medical-ar | Yes | 1.02 |
| ما مهلة تقديم المطالبة الطبية؟ | medical-ar | Yes | 1.05 |
| Are cryptocurrency mining rigs insured? | Not found | Yes | 0.88 |
| What benefits exist for lunar tourism? | Not found | Yes | 0.83 |
