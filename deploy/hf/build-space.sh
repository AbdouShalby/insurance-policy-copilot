#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 1 ]]; then echo 'Usage: bash deploy/hf/build-space.sh TARGET_FOLDER' >&2; exit 2; fi
source_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
# Refuse existing destinations so stale files (including secrets) cannot be published.
if [[ -e "$1" ]]; then echo 'Target must be a new folder.' >&2; exit 2; fi
mkdir -p -- "$1"
target="$(cd -- "$1" && pwd)"
mkdir -p "$target/apps/api/src" "$target/apps/api/public" "$target/services/ingest" "$target/samples/policies" "$target/deploy/hf"
cp "$source_root/deploy/hf/Dockerfile" "$target/Dockerfile"
cp "$source_root/deploy/hf/README.md" "$target/README.md"
cp "$source_root/deploy/hf/Dockerfile.dockerignore" "$target/.dockerignore"
cp "$source_root/deploy/hf/.gitattributes" "$target/.gitattributes"
cp "$source_root/deploy/hf/start.sh" "$target/deploy/hf/start.sh"
cp "$source_root/apps/api/package.json" "$source_root/apps/api/package-lock.json" "$source_root/apps/api/tsconfig.json" "$target/apps/api/"
cp "$source_root/apps/api/src/"*.ts "$target/apps/api/src/"
cp "$source_root/apps/api/public/index.html" "$target/apps/api/public/index.html"
cp "$source_root/services/ingest/requirements.txt" "$source_root/services/ingest/"*.py "$target/services/ingest/"
cp "$source_root/samples/policies/"*.md "$target/samples/policies/"
echo "Space sources assembled in $target. Review before publishing."
