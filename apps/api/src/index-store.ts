import MiniSearch from 'minisearch';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Chunk } from './types';

export function normalizeArabic(text: string): string {
  return text.replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
}

export function tokenize(text: string): string[] {
  return normalizeArabic(text.toLowerCase().normalize('NFKC'))
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    .map(token => token.length > 3 ? token.replace(/^(?:وال|بال|كال|فال|لل|ال)(?=[\u0621-\u064a])/u, '') : token);
}

const STOP_WORDS = new Set(tokenize('a an the is are does do what how when where which can i my me ' +
  'for of to in on and or policy document documents please tell about ' +
  'ما هل في من عن على هو هي كم ماذا وثيقة الوثيقة'));

export function contentTerms(text: string): string[] {
  return [...new Set(tokenize(text).filter(term => !STOP_WORDS.has(term)))];
}

export class IndexStore {
  private index = this.createIndex();
  private chunks: Chunk[] = [];
  private writes: Promise<void> = Promise.resolve();

  constructor(private readonly path: string, private readonly readOnly = process.env.INDEX_READ_ONLY === 'true') {}

  private createIndex(): MiniSearch<Chunk> {
    return new MiniSearch<Chunk>({ idField: 'chunk_id', fields: ['text', 'title'],
      storeFields: ['doc_id', 'title', 'page', 'chunk_id', 'text', 'lang'], tokenize });
  }

  async load(): Promise<void> {
    try {
      const saved = JSON.parse(await readFile(this.path, 'utf8')) as { version: number; chunks: Chunk[] };
      if (this.readOnly && (saved.version !== 1 || !Array.isArray(saved.chunks) || !saved.chunks.length ||
        saved.chunks.some(chunk => !chunk || typeof chunk.doc_id !== 'string' || !chunk.doc_id ||
          typeof chunk.chunk_id !== 'string' || !chunk.chunk_id || typeof chunk.title !== 'string' ||
          typeof chunk.text !== 'string' || !chunk.text || !Number.isInteger(chunk.page) || chunk.page < 1 ||
          !['ar', 'en'].includes(chunk.lang)))) throw new Error('Invalid read-only index');
      this.index.addAll(saved.chunks);
      this.chunks = saved.chunks;
    } catch (error) {
      if (this.readOnly || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async replace(docId: string, chunks: Chunk[]): Promise<void> {
    if (this.readOnly) throw new Error('Index is read-only');
    const work = this.writes.then(async () => {
      const next = this.chunks.filter(chunk => chunk.doc_id !== docId).concat(chunks);
      const nextIndex = this.createIndex();
      nextIndex.addAll(next);
      await mkdir(dirname(this.path), { recursive: true });
      // Publish to memory only after an atomic on-disk replacement succeeds.
      await writeFile(`${this.path}.tmp`, JSON.stringify({ version: 1, chunks: next }), 'utf8');
      await rename(`${this.path}.tmp`, this.path);
      this.chunks = next;
      this.index = nextIndex;
    });
    this.writes = work.catch(() => undefined);
    return work;
  }

  search(question: string, topK: number): Chunk[] {
    const terms = contentTerms(question);
    if (!terms.length) return [];
    return this.index.search(terms.join(' '), { prefix: false, fuzzy: false, combineWith: 'OR' })
      .filter(result => {
        const sourceTerms = new Set(tokenize(`${result.title} ${result.text}`));
        return result.score >= 0.2 && terms.filter(term => sourceTerms.has(term)).length >= Math.ceil(terms.length / 2);
      })
      .slice(0, topK).map(result => ({ doc_id: result.doc_id, title: result.title,
        page: result.page, chunk_id: result.chunk_id, text: result.text, lang: result.lang }));
  }
}
