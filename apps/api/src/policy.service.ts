import { BadGatewayException, HttpException, Injectable, OnModuleInit } from '@nestjs/common';
import { contentTerms, IndexStore, tokenize } from './index-store';
import { LlmAdapter } from './llm';
import { Answer, Chunk } from './types';

@Injectable()
export class PolicyService implements OnModuleInit {
  readonly store = new IndexStore(process.env.INDEX_PATH || 'data/index/index.json');

  constructor(private readonly llm: LlmAdapter) {}

  async onModuleInit(): Promise<void> { await this.store.load(); }

  async ingest(file: Express.Multer.File, docId: string, title: string): Promise<{ doc_id: string; chunks: number }> {
    const form = new FormData();
    form.set('doc_id', docId);
    form.set('title', title);
    form.set('file', new Blob([new Uint8Array(file.buffer)]), file.originalname);
    let chunks: Chunk[];
    try {
      const response = await fetch(`${process.env.INGEST_URL || 'http://localhost:8001'}/ingest`, {
        method: 'POST', body: form, signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        if ([400, 413, 422].includes(response.status)) {
          throw new HttpException({ message: 'Ingest rejected the document', detail: await response.json() }, response.status);
        }
        throw new Error('Ingest failed');
      }
      const body = await response.json() as { chunks: Chunk[] };
      chunks = body.chunks;
      if (!Array.isArray(chunks) || !chunks.length || chunks.some(chunk =>
        chunk.doc_id !== docId || !chunk.chunk_id || typeof chunk.text !== 'string' ||
        typeof chunk.title !== 'string' || !Number.isInteger(chunk.page) || chunk.page < 1 ||
        !['ar', 'en'].includes(chunk.lang))) throw new Error('Invalid ingest response');
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadGatewayException('Ingest service unavailable or returned invalid chunks');
    }
    await this.store.replace(docId, chunks);
    return { doc_id: docId, chunks: chunks.length };
  }

  async ask(question: string, topK = 3): Promise<Answer> {
    const chunks = this.store.search(question, topK);
    if (!chunks.length) return { answer: 'Not found in the policy documents.', citations: [], mode: 'extractive' };
    const questionTerms = new Set(contentTerms(question));
    const citations = chunks.map(chunk => {
      const sentences = readableText(chunk.text, chunk.title).split(/(?<=[.!?؟])\s+/u);
      const ranked = sentences.map((text, order) => ({ text, order,
        score: tokenize(text).filter(term => questionTerms.has(term)).length }))
        .sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 2)
        .sort((a, b) => a.order - b.order);
      return { doc_id: chunk.doc_id, title: chunk.title, page: chunk.page,
        chunk_id: chunk.chunk_id, snippet: ranked.map(sentence => sentence.text).join(' ') };
    });
    if (this.llm.enabled()) {
      try { return { answer: await this.llm.answer(question, citations), citations, mode: 'llm' }; }
      catch { throw new BadGatewayException('LLM service unavailable'); }
    }
    return { answer: citations.map(citation => `${citation.snippet} [${citation.chunk_id}]`).join('\n'),
      citations, mode: 'extractive' };
  }
}

/** Drops markdown heading markers and a leading repeat of the document title, which the
 * ingest chunker folds into the first sentence, so answers start with policy text. */
export function readableText(text: string, title: string): string {
  let cleaned = text.replace(/(^|\s)#{1,6}\s+/g, '$1').trim();
  if (title && cleaned.startsWith(title)) cleaned = cleaned.slice(title.length).trim();
  return cleaned || text;
}
