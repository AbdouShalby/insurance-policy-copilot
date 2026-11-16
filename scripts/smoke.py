"""Load synthetic policies and exercise the local question and signed CRM journey."""

import argparse
import hashlib
import hmac
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from uuid import uuid4


def send(url: str, data: bytes, headers: dict[str, str]) -> dict:
    with urlopen(Request(url, data=data, headers=headers, method="POST"), timeout=40) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-url", default="http://127.0.0.1:3000")
    args = parser.parse_args()
    secret = os.environ.get("CRM_WEBHOOK_SECRET")
    if not secret:
        raise SystemExit("Set CRM_WEBHOOK_SECRET to the same local test value as the API process.")
    root = Path(__file__).resolve().parents[1]
    for path in sorted((root / "samples" / "policies").glob("*.md")):
        boundary = f"policy-{uuid4().hex}"
        title = path.read_text(encoding="utf-8").splitlines()[0].lstrip("# ")
        fields = b"".join(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
                          for name, value in [("doc_id", path.stem), ("title", title)])
        body = (fields + f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{path.name}"\r\nContent-Type: text/markdown\r\n\r\n'.encode()
                + path.read_bytes() + f"\r\n--{boundary}--\r\n".encode())
        result = send(f"{args.api_url}/documents", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
        assert result["chunks"] > 0
        print(f"Loaded {path.stem}: {result['chunks']} chunks")
    answer = send(f"{args.api_url}/ask", json.dumps({"question": "What is the windscreen repairs limit?"}).encode(),
                  {"Content-Type": "application/json"})
    assert answer["mode"] == "extractive" and any(c["doc_id"] == "motor" for c in answer["citations"])
    assert "5000" in answer["answer"]
    body = json.dumps({"event_id": f"smoke-{uuid4().hex}", "case_id": "fictional-case-001",
                       "customer_question": "What is the windscreen repairs limit?"}, separators=(",", ":")).encode()
    headers = {"Content-Type": "application/json", "X-Signature": "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()}
    first = send(f"{args.api_url}/webhooks/crm", body, headers)
    replay = send(f"{args.api_url}/webhooks/crm", body, headers)
    assert first == replay and first["citations"]
    print("PASS: cited extractive answer, valid signed CRM delivery, exact replay")


if __name__ == "__main__":
    main()
