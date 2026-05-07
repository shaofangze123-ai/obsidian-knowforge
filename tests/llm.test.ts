import { parseChatResponse, parseEmbeddingResponse, parseBatchEmbeddingResponse } from '../src/llm';

describe('parseChatResponse', () => {
  it('extracts text from valid response', () => {
    const response = {
      choices: [{
        message: { role: 'assistant', content: 'Hello world' },
        finish_reason: 'stop',
      }],
    };
    expect(parseChatResponse(response)).toBe('Hello world');
  });

  it('returns empty string for empty choices', () => {
    expect(parseChatResponse({ choices: [] })).toBe('');
  });

  it('returns empty string for null/undefined', () => {
    expect(parseChatResponse(null)).toBe('');
    expect(parseChatResponse(undefined)).toBe('');
  });
});

describe('parseEmbeddingResponse', () => {
  it('extracts vector from embedding response', () => {
    const response = {
      data: [{ embedding: [0.1, 0.2, 0.3], index: 0 }],
    };
    expect(parseEmbeddingResponse(response)).toEqual([0.1, 0.2, 0.3]);
  });

  it('returns empty array for missing data', () => {
    expect(parseEmbeddingResponse({})).toEqual([]);
  });
});

describe('parseBatchEmbeddingResponse', () => {
  it('extracts vectors sorted by index', () => {
    const response = {
      data: [
        { embedding: [0.3, 0.4], index: 1 },
        { embedding: [0.1, 0.2], index: 0 },
      ],
    };
    expect(parseBatchEmbeddingResponse(response)).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('returns empty array for missing data', () => {
    expect(parseBatchEmbeddingResponse({})).toEqual([]);
  });
});
