import { parseGeminiChatResponse, parseGeminiEmbeddingResponse, parseGeminiBatchEmbeddingResponse } from '../src/gemini';

describe('parseGeminiChatResponse', () => {
  it('extracts text from valid response', () => {
    const response = {
      candidates: [{
        content: {
          parts: [{ text: 'Hello world' }],
          role: 'model'
        }
      }]
    };
    expect(parseGeminiChatResponse(response)).toBe('Hello world');
  });

  it('returns empty string for empty candidates', () => {
    expect(parseGeminiChatResponse({ candidates: [] })).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(parseGeminiChatResponse(null)).toBe('');
    expect(parseGeminiChatResponse(undefined)).toBe('');
  });

  it('concatenates multiple parts', () => {
    const response = {
      candidates: [{
        content: {
          parts: [{ text: 'Part 1' }, { text: ' Part 2' }],
          role: 'model'
        }
      }]
    };
    expect(parseGeminiChatResponse(response)).toBe('Part 1 Part 2');
  });
});

describe('parseGeminiEmbeddingResponse', () => {
  it('extracts vector from single embedding response', () => {
    const response = {
      embedding: { values: [0.1, 0.2, 0.3] }
    };
    expect(parseGeminiEmbeddingResponse(response)).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns empty array for missing embedding', () => {
    expect(parseGeminiEmbeddingResponse({})).toEqual([]);
  });
});

describe('parseGeminiBatchEmbeddingResponse', () => {
  it('extracts vectors from batch response', () => {
    const response = {
      embeddings: [
        { values: [0.1, 0.2] },
        { values: [0.3, 0.4] }
      ]
    };
    expect(parseGeminiBatchEmbeddingResponse(response)).toEqual([
      [0.1, 0.2],
      [0.3, 0.4]
    ]);
  });

  it('returns empty array for missing embeddings', () => {
    expect(parseGeminiBatchEmbeddingResponse({})).toEqual([]);
  });
});
