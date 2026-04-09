import { VectorStore, cosineSimilarity } from '../src/vectorStore';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
  });

  it('handles non-unit vectors', () => {
    expect(cosineSimilarity([3, 4], [6, 8])).toBeCloseTo(1);
  });
});

describe('VectorStore.chunkText', () => {
  it('returns single chunk for short text', () => {
    const chunks = VectorStore.chunkText('hello world');
    expect(chunks).toEqual(['hello world']);
  });

  it('returns empty array for empty text', () => {
    expect(VectorStore.chunkText('')).toEqual([]);
    expect(VectorStore.chunkText('   ')).toEqual([]);
  });

  it('splits long text into overlapping chunks', () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = VectorStore.chunkText(text, 30, 5);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should have <= 30 words
    for (const chunk of chunks) {
      expect(chunk.split(' ').length).toBeLessThanOrEqual(30);
    }
  });
});

describe('VectorStore', () => {
  let store: VectorStore;

  beforeEach(() => {
    store = new VectorStore();
  });

  it('starts with 0 records', () => {
    expect(store.getRecordCount()).toBe(0);
  });

  it('serializes and loads', () => {
    const json = store.serialize();
    const store2 = new VectorStore();
    store2.load(json);
    expect(store2.getRecordCount()).toBe(0);
  });

  it('searchByVector returns results sorted by similarity', () => {
    // Manually load some records
    const json = JSON.stringify({
      version: 1,
      embeddingModel: 'test',
      dimensions: 3,
      records: [
        { filePath: 'a.md', content: 'Alpha', chunkIndex: 0, vector: [1, 0, 0], mtime: 1 },
        { filePath: 'b.md', content: 'Beta', chunkIndex: 0, vector: [0, 1, 0], mtime: 1 },
        { filePath: 'c.md', content: 'Gamma', chunkIndex: 0, vector: [0.9, 0.1, 0], mtime: 1 },
      ],
    });
    store.load(json);
    expect(store.getRecordCount()).toBe(3);

    const results = store.searchByVector([1, 0, 0], 2, 0.1);
    expect(results.length).toBe(2);
    expect(results[0].filePath).toBe('a.md');
    expect(results[0].similarity).toBeCloseTo(1);
    expect(results[1].filePath).toBe('c.md');
  });

  it('searchByVector respects threshold', () => {
    const json = JSON.stringify({
      version: 1,
      embeddingModel: 'test',
      dimensions: 2,
      records: [
        { filePath: 'a.md', content: 'Alpha', chunkIndex: 0, vector: [1, 0], mtime: 1 },
        { filePath: 'b.md', content: 'Beta', chunkIndex: 0, vector: [0, 1], mtime: 1 },
      ],
    });
    store.load(json);

    const results = store.searchByVector([1, 0], 10, 0.9);
    expect(results.length).toBe(1);
    expect(results[0].filePath).toBe('a.md');
  });

  it('removeFile removes records', () => {
    const json = JSON.stringify({
      version: 1,
      embeddingModel: 'test',
      dimensions: 2,
      records: [
        { filePath: 'a.md', content: 'A', chunkIndex: 0, vector: [1, 0], mtime: 1 },
        { filePath: 'b.md', content: 'B', chunkIndex: 0, vector: [0, 1], mtime: 1 },
      ],
    });
    store.load(json);
    store.removeFile('a.md');
    expect(store.getRecordCount()).toBe(1);
    expect(store.getIndexedFiles()).toEqual(['b.md']);
  });

  it('hasFile checks path and mtime', () => {
    const json = JSON.stringify({
      version: 1,
      embeddingModel: 'test',
      dimensions: 2,
      records: [
        { filePath: 'a.md', content: 'A', chunkIndex: 0, vector: [1, 0], mtime: 100 },
      ],
    });
    store.load(json);
    expect(store.hasFile('a.md', 100)).toBe(true);
    expect(store.hasFile('a.md', 50)).toBe(true);
    expect(store.hasFile('a.md', 200)).toBe(false);
    expect(store.hasFile('b.md', 100)).toBe(false);
  });

  it('rejects incompatible version on load', () => {
    const json = JSON.stringify({
      version: 999,
      embeddingModel: 'old',
      dimensions: 2,
      records: [
        { filePath: 'a.md', content: 'A', chunkIndex: 0, vector: [1, 0], mtime: 1 },
      ],
    });
    store.load(json);
    // Should have discarded records due to version mismatch
    expect(store.getRecordCount()).toBe(0);
  });
});
