export interface Chunk {
  doc_id: string;
  title: string;
  chunk_id: string;
  page: number;
  text: string;
  lang: 'ar' | 'en';
}

export interface Citation {
  doc_id: string;
  title: string;
  page: number;
  chunk_id: string;
  snippet: string;
}

export interface Answer {
  answer: string;
  citations: Citation[];
  mode: 'extractive' | 'llm';
}
