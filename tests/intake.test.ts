import { parseCardResponse, sanitizeFileName } from '../src/intake';

describe('parseCardResponse', () => {
  it('parses valid card response', () => {
    const response = `TITLE: React Hooks 入门
TAGS: react, hooks, frontend
CONTENT:
## React Hooks

React Hooks 是 React 16.8 引入的新特性。

### useState
用于管理组件状态。`;

    const card = parseCardResponse(response);
    expect(card).not.toBeNull();
    expect(card!.title).toBe('React Hooks 入门');
    expect(card!.tags).toEqual(['react', 'hooks', 'frontend']);
    expect(card!.content).toContain('React Hooks');
    expect(card!.content).toContain('useState');
  });

  it('returns null for empty response', () => {
    expect(parseCardResponse('')).toBeNull();
    expect(parseCardResponse(null as any)).toBeNull();
  });

  it('returns null for invalid format', () => {
    expect(parseCardResponse('Just some random text')).toBeNull();
  });

  it('handles response without TAGS', () => {
    const response = `TITLE: Simple Note
CONTENT:
Some content here.`;
    const card = parseCardResponse(response);
    expect(card).not.toBeNull();
    expect(card!.title).toBe('Simple Note');
    expect(card!.tags).toEqual([]);
    expect(card!.content).toBe('Some content here.');
  });
});

describe('sanitizeFileName', () => {
  it('removes forbidden characters', () => {
    expect(sanitizeFileName('file:name*test?')).toBe('filenametest');
  });

  it('collapses whitespace', () => {
    expect(sanitizeFileName('hello    world')).toBe('hello world');
  });

  it('limits length to 100', () => {
    const long = 'a'.repeat(150);
    expect(sanitizeFileName(long).length).toBe(100);
  });

  it('handles Chinese characters', () => {
    expect(sanitizeFileName('React Hooks 入门指南')).toBe('React Hooks 入门指南');
  });
});
