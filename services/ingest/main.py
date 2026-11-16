"""Stateless policy document ingestion."""

from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pypdf import PdfReader

from chunking import chunk_page

MAX_BYTES = 10 * 1024 * 1024
app = FastAPI(title="Insurance Policy Ingest")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/ingest")
async def ingest(file: UploadFile = File(...), doc_id: str = Form(...),
                 title: str = Form(...)) -> dict:
    if not doc_id.strip() or not title.strip():
        raise HTTPException(400, "doc_id and title must not be blank")
    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".pdf", ".md", ".txt"}:
        raise HTTPException(400, "Unsupported file; use .pdf, .md or .txt")
    content = await file.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "File exceeds the 10 MB upload limit")
    if not content:
        raise HTTPException(400, "Document is empty")
    try:
        if extension == ".pdf":
            reader = PdfReader(BytesIO(content))
            pages = [page.extract_text() or "" for page in reader.pages]
        else:
            pages = [content.decode("utf-8-sig")]
    except Exception as error:
        raise HTTPException(400, "Cannot read document; provide a valid PDF or UTF-8 text file") from error
    chunks = [chunk for number, text in enumerate(pages, 1)
              for chunk in chunk_page(text, doc_id.strip(), title.strip(), number)]
    if not chunks:
        raise HTTPException(400, "Document has no extractable text; scanned PDFs require OCR")
    return {"chunks": chunks}
