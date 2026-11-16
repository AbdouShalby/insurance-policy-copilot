#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
python="$root/services/ingest/.venv/bin/python"
[ -x "$python" ] || { echo 'Install the Python venv and requirements first; see README.md.'; exit 1; }
export PORT="${PORT:-3000}" INGEST_PORT="${INGEST_PORT:-8001}" HOST=127.0.0.1
export INGEST_URL="http://127.0.0.1:$INGEST_PORT"
export CRM_WEBHOOK_SECRET="${CRM_WEBHOOK_SECRET:-synthetic-local-demo-only}" ANTHROPIC_API_KEY=''
"$python" - "$PORT" "$INGEST_PORT" <<'PY'
import socket
import sys
for port in sys.argv[1:]:
    with socket.socket() as probe:
        if probe.connect_ex(("127.0.0.1", int(port))) == 0:
            raise SystemExit(f"Port {port} is already occupied; select alternate ports.")
PY
(cd "$root/apps/api" && npm run build)
INGEST_PID='' API_PID=''
cleanup() { [ -z "$API_PID" ] || kill "$API_PID" 2>/dev/null || true; [ -z "$INGEST_PID" ] || kill "$INGEST_PID" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 130' INT TERM
(cd "$root/services/ingest" && exec "$python" -m uvicorn main:app --host 127.0.0.1 --port "$INGEST_PORT") &
INGEST_PID=$!
(cd "$root/apps/api" && exec node dist/main.js) &
API_PID=$!
for port in "$INGEST_PORT" "$PORT"; do
  ready=false
  for attempt in {1..60}; do
    kill -0 "$INGEST_PID" "$API_PID" || exit 1
    if curl -fsS "http://127.0.0.1:$port/health" >/dev/null; then ready=true; break; fi
    sleep 1
  done
  [ "$ready" = true ] || { echo 'Service readiness timed out'; exit 1; }
done
curl -fsS -X POST -H 'Content-Type: application/json' -d '{}' "http://127.0.0.1:$PORT/samples"
echo "Ready: http://127.0.0.1:$PORT (Ctrl+C stops owned services)"
wait -n "$INGEST_PID" "$API_PID"
