"""Page-preserving sentence chunking with bounded overlap."""

import re
from typing import TypedDict


class Chunk(TypedDict):
    doc_id: str
    title: str
    chunk_id: str
    page: int
    text: str
    lang: str


def detect_language(text: str) -> str:
    letters = [char for char in text if char.isalpha()]
    arabic = sum("\u0600" <= char <= "\u06ff" for char in letters)
    return "ar" if arabic / max(len(letters), 1) > 0.3 else "en"


def chunk_page(text: str, doc_id: str, title: str, page: int) -> list[Chunk]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?؟])\s+", text)
    # Hard-split pathological sentences so an unpunctuated upload stays bounded.
    units = [sentence[i:i + 850] for sentence in sentences
             for i in range(0, len(sentence), 850)]
    blocks: list[str] = []
    current = ""
    for unit in units:
        if current and len(current) + len(unit) + 1 > 900:
            blocks.append(current)
            tail = re.split(r"(?<=[.!?؟])\s+", current)[-1]
            current = tail if len(tail) <= 120 and len(tail) + len(unit) + 1 <= 900 else ""
        current = f"{current} {unit}".strip()
    if current:
        blocks.append(current)
    return [Chunk(doc_id=doc_id, title=title, chunk_id=f"{doc_id}:p{page}:c{index + 1}",
                  page=page, text=block, lang=detect_language(block))
            for index, block in enumerate(blocks)]
