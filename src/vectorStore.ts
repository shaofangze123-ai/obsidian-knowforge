import type { VectorRecord, VectorIndex, SearchResult } from './types';
import type { LLMClient } from './llm';

const CURRENT_VERSION = 1;

/**
 * 内存向量存储 — JSON 持久化，cosine similarity 检索
 */
export class VectorStore {
  private index: VectorIndex;
  private dirty = false;

  constructor() {
    this.index = {
      version: CURRENT_VERSION,
      embeddingModel: '',
      dimensions: 0,
      records: [],
    };
  }

  // ===== 持久化 =====

  serialize(): string {
    return JSON.stringify(this.index);
  }

  load(json: string): void {
    const parsed: VectorIndex = JSON.parse(json);
    if (parsed.version !== CURRENT_VERSION) {
      // 版本不兼容，重建
      this.index = {
        version: CURRENT_VERSION,
        embeddingModel: parsed.embeddingModel || '',
        dimensions: 0,
        records: [],
      };
      return;
    }
    this.index = parsed;
    this.dirty = false;
  }

  isDirty(): boolean {
    return this.dirty;
  }

  getRecordCount(): number {
    return this.index.records.length;
  }

  // ===== 文本分块 =====

  static chunkText(text: string, maxChunkSize = 400, overlap = 50): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return [];
    if (words.length <= maxChunkSize) return [words.join(' ')];

    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + maxChunkSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start = end - overlap;
      if (start >= words.length) break;
      // 防止无限循环
      if (end === words.length) break;
    }
    return chunks;
  }

  // ===== 索引操作 =====

  /**
   * 索引一个文件：分块 → embedding → 存储
   */
  async indexFile(
    filePath: string,
    content: string,
    mtime: number,
    llm: LLMClient,
  ): Promise<void> {
    // 移除旧记录
    this.removeFile(filePath);

    const chunks = VectorStore.chunkText(content);
    if (chunks.length === 0) return;

    const vectors = await llm.embedBatch(chunks);

    for (let i = 0; i < chunks.length; i++) {
      const vec = vectors[i];
      if (!vec || vec.length === 0) continue;

      if (this.index.dimensions === 0) {
        this.index.dimensions = vec.length;
      }

      this.index.records.push({
        filePath,
        content: chunks[i],
        chunkIndex: i,
        vector: vec,
        mtime,
      });
    }

    this.index.embeddingModel = 'text-embedding-004';
    this.dirty = true;
  }

  removeFile(filePath: string): void {
    const before = this.index.records.length;
    this.index.records = this.index.records.filter(r => r.filePath !== filePath);
    if (this.index.records.length !== before) {
      this.dirty = true;
    }
  }

  hasFile(filePath: string, mtime: number): boolean {
    return this.index.records.some(r => r.filePath === filePath && r.mtime >= mtime);
  }

  // ===== 检索 =====

  /**
   * 余弦相似度搜索
   */
  async search(
    query: string,
    llm: LLMClient,
    topK = 5,
    threshold = 0.3,
  ): Promise<SearchResult[]> {
    if (this.index.records.length === 0) return [];

    const queryVec = await llm.embed(query);
    if (queryVec.length === 0) return [];

    return this.searchByVector(queryVec, topK, threshold);
  }

  /**
   * 纯向量搜索（可独立测试）
   */
  searchByVector(queryVec: number[], topK: number, threshold: number): SearchResult[] {
    const scored = this.index.records
      .map(r => ({
        filePath: r.filePath,
        content: r.content,
        similarity: cosineSimilarity(queryVec, r.vector),
      }))
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return scored;
  }

  /**
   * 获取所有已索引文件路径
   */
  getIndexedFiles(): string[] {
    const files = new Set(this.index.records.map(r => r.filePath));
    return [...files];
  }
}

// ===== 数学工具 =====

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}
