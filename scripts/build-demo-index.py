"""Build the synthetic snapshot with the real Python chunker and API IndexStore."""

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ingest"))
from chunking import chunk_page  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the committed snapshot without writing it")
    args = parser.parse_args()
    documents = []
    for doc_id in ["motor", "medical", "travel", "home", "medical-ar"]:
        content = (ROOT / "samples" / "policies" / f"{doc_id}.md").read_bytes().decode("utf-8-sig")
        title = content.split("\n")[0].removeprefix("# ").strip()
        documents.append({"id": doc_id, "chunks": chunk_page(content, doc_id, title, 1)})
    # IndexStore owns the snapshot format and document replacement ordering.
    program = """
const {IndexStore} = require('./apps/api/dist/index-store');
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', data => input += data);
process.stdin.on('end', async () => {
  try {
    const store = new IndexStore(process.argv[1], false);
    for (const doc of JSON.parse(input)) await store.replace(doc.id, doc.chunks);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
});
"""
    with tempfile.TemporaryDirectory(prefix="policy-demo-index-") as directory:
        generated = Path(directory) / "index.json"
        subprocess.run(["node", "-e", program, str(generated)], cwd=ROOT,
                       input=json.dumps(documents, ensure_ascii=False), encoding="utf-8", check=True)
        content = generated.read_bytes()
    target = ROOT / "deploy" / "vercel" / "demo-index.json"
    if args.check:
        if target.read_bytes() != content:
            raise SystemExit("Committed demo index differs; regenerate it before deployment.")
        print("Demo index matches the real chunker and API indexing output.")
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
        print(f"Generated {target.relative_to(ROOT)} ({len(content)} bytes).")


if __name__ == "__main__":
    main()
