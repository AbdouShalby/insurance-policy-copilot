"""Evaluate the local API using only the Python standard library."""

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from time import perf_counter
from urllib.request import Request, urlopen


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default="http://127.0.0.1:3000")
    parser.add_argument("--min-hit-rate", type=float, default=0.85)
    parser.add_argument("--min-not-found", type=float, default=1.0)
    args = parser.parse_args()
    folder = Path(__file__).resolve().parent
    questions = json.loads((folder / "questions.json").read_text(encoding="utf-8"))
    results = []
    for item in questions:
        request = Request(f"{args.api_url}/ask", method="POST",
                          data=json.dumps({"question": item["question"], "top_k": 3}).encode(),
                          headers={"Content-Type": "application/json"})
        started = perf_counter()
        with urlopen(request, timeout=40) as response:
            answer = json.load(response)
        elapsed = (perf_counter() - started) * 1000
        expected = item["expected_doc_id"]
        hit = (any(citation["doc_id"] == expected and citation["page"] == item.get("expected_page", 1)
                   for citation in answer["citations"]) if expected else not answer["citations"])
        results.append({**item, "hit": hit, "latency_ms": elapsed, "mode": answer["mode"]})
    known = [item for item in results if item["expected_doc_id"]]
    unknown = [item for item in results if not item["expected_doc_id"]]
    arabic = [item for item in known if re.search(r"[\u0600-\u06ff]", item["question"])]
    english = [item for item in known if item not in arabic]
    hit_rate = sum(i["hit"] for i in known) / len(known)
    not_found = sum(i["hit"] for i in unknown) / len(unknown)
    lines = ["# Local evaluation results", "",
             f"Run at: {datetime.now(timezone.utc).isoformat()}", "",
             f"- Retrieval hit rate at k=3 (document and page): {sum(i['hit'] for i in known)}/{len(known)} ({sum(i['hit'] for i in known) / len(known):.1%})",
             f"- Not-found accuracy (unanswerable questions): {sum(i['hit'] for i in unknown)}/{len(unknown)} ({sum(i['hit'] for i in unknown) / len(unknown):.1%})",
             *[f"- {language} hit@3: {sum(i['hit'] for i in items)}/{len(items)} ({sum(i['hit'] for i in items) / len(items):.1%})" for language, items in [("Arabic", arabic), ("English", english)]],
             f"- Average latency: {sum(i['latency_ms'] for i in results) / len(results):.2f} ms",
             f"- Modes: {', '.join(sorted({i['mode'] for i in results}))}", "",
             "This small synthetic lexical-retrieval check measures source selection, not answer correctness or production readiness.", "",
             "| Question | Expected document | Hit | Latency (ms) |", "| --- | --- | --- | --- |"]
    lines.extend(f"| {item['question']} | {item['expected_doc_id'] or 'Not found'} | {'Yes' if item['hit'] else 'No'} | {item['latency_ms']:.2f} |" for item in results)
    report = "\n".join(lines) + "\n"
    (folder / "results.md").write_text(report, encoding="utf-8")
    print(report)
    if hit_rate < args.min_hit_rate or not_found < args.min_not_found or any(i["mode"] != "extractive" for i in results):
        raise SystemExit("Evaluation gate failed (retrieval, abstention or extractive mode).")


if __name__ == "__main__":
    main()
