from io import BytesIO

from fastapi.testclient import TestClient
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from chunking import chunk_page, detect_language
from main import MAX_BYTES, app

client = TestClient(app)


def upload(content: bytes, filename: str = "policy.txt"):
    return client.post("/ingest", data={"doc_id": "test", "title": "Fictional policy"},
                       files={"file": (filename, content)})


def test_chunks_boundaries_and_overlap():
    sentences = [f"Clause {i} covers fictional motor damage and claim settlement." for i in range(50)]
    chunks = chunk_page(" ".join(sentences), "motor", "Motor", 2)
    assert len(chunks) > 1
    assert all(len(c["text"]) <= 900 and c["page"] == 2 for c in chunks)
    assert all(c["text"].endswith(".") for c in chunks)
    assert len({c["chunk_id"] for c in chunks}) == len(chunks)
    for sentence in sentences:
        assert any(sentence in c["text"] for c in chunks)
    assert chunks[0]["text"].split(". ")[-1] in chunks[1]["text"]


def test_long_sentence_is_bounded():
    chunks = chunk_page("x" * 2000, "long", "Long", 1)
    assert "".join(c["text"] for c in chunks) == "x" * 2000
    assert max(len(c["text"]) for c in chunks) <= 900


def test_arabic_and_text():
    assert detect_language("العلاج الطبي مشمول في الوثيقة.") == "ar"
    assert detect_language("Medical treatment is covered.") == "en"
    response = upload("العلاج الطبي مشمول في الوثيقة.".encode())
    assert response.status_code == 200
    assert response.json()["chunks"][0]["lang"] == "ar"


def test_pdf_page_extraction():
    writer = PdfWriter()
    for text in ["Fictional policy page one", "Dental cover page two"]:
        page = writer.add_blank_page(width=200, height=200)
        font = DictionaryObject({NameObject("/Type"): NameObject("/Font"),
                                 NameObject("/Subtype"): NameObject("/Type1"),
                                 NameObject("/BaseFont"): NameObject("/Helvetica")})
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({
            NameObject("/F1"): writer._add_object(font)})})
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 10 100 Td ({text}) Tj ET".encode())
        page[NameObject("/Contents")] = writer._add_object(stream)
    buffer = BytesIO()
    writer.write(buffer)
    response = upload(buffer.getvalue(), "test.pdf")
    assert response.status_code == 200
    chunks = response.json()["chunks"]
    assert [c["page"] for c in chunks] == [1, 2]
    assert "Dental" in chunks[1]["text"]


def test_errors():
    assert upload(b"").status_code == 400
    assert upload(b"   ").status_code == 400
    assert upload(b"test", "test.exe").status_code == 400
    assert upload(b"broken", "test.pdf").status_code == 400
    assert upload(b"\xff").status_code == 400
    assert upload(b"a" * (MAX_BYTES + 1)).status_code == 413
    assert client.post("/ingest").status_code == 422
    assert client.get("/health").json() == {"status": "ok"}
