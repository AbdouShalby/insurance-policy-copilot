#!/usr/bin/env bash
set -euo pipefail

# This image is always the read-only, extractive profile, regardless of injected keys.
unset ANTHROPIC_API_KEY REDIS_URL CRM_WEBHOOK_SECRET
export DEMO_MODE=true SEED_SAMPLES_ON_START=true
export HOST=0.0.0.0 PORT=7860 INGEST_URL=http://127.0.0.1:8001
export INDEX_PATH="${INDEX_PATH:-/home/app/data/index.json}"
ingest_pid=''
api_pid=''
cleanup() {
  trap - EXIT TERM INT
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
  if [[ -n "$ingest_pid" ]]; then kill "$ingest_pid" 2>/dev/null || true; fi
  wait || true
}
trap cleanup EXIT
trap 'exit 143' TERM
trap 'exit 130' INT

cd /home/app/services/ingest
python -m uvicorn main:app --host 127.0.0.1 --port 8001 &
ingest_pid=$!
python - <<'PY'
import time
import urllib.request

deadline = time.monotonic() + 30
while True:
    try:
        with urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=1) as response:
            if response.status == 200:
                break
    except OSError:
        pass
    if time.monotonic() >= deadline:
        raise SystemExit('Ingest did not become ready within 30 seconds')
    time.sleep(0.2)
PY
kill -0 "$ingest_pid"
cd /home/app/apps/api
node dist/main.js &
api_pid=$!
# Any child exit, even exit 0, must stop the whole container so HF can restart it.
set +e
wait -n "$ingest_pid" "$api_pid"
status=$?
set -e
if [[ "$status" -eq 0 ]]; then status=1; fi
exit "$status"
