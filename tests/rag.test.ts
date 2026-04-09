import { buildRAGContext, buildSystemPrompt } from '../src/rag';
import type { SearchResult, RAGContext } from '../src/types';

describe('buildRAGContext', () => {
  it('returns empty context for no results', () => {
    const ctx = buildRAGContext([]);
    expect(ctx.text).toBe('');
    expect(ctx.sources).toEqual([]);
  });

  it('builds context from search results', () => {
    const results: SearchResult[] = [
      { filePath: 'notes/react.md', content: 'React is a UI library', similarity: 0.9 },
      { filePath: 'notes/vue.md', content: 'Vue is a framework', similarity: 0.7 },
    ];
    const ctx = buildRAGContext(results);
    expect(ctx.text).toContain('react.md');
    expect(ctx.text).toContain('React is a UI library');
    expect(ctx.text).toContain('vue.md');
    expect(ctx.sources.length).toBe(2);
    expect(ctx.sources[0].similarity).toBeGreaterThanOrEqual(ctx.sources[1].similarity);
  });

  it('groups chunks from same file', () => {
    const results: SearchResult[] = [
      { filePath: 'notes/js.md', content: 'Chunk 1', similarity: 0.9 },
      { filePath: 'notes/js.md', content: 'Chunk 2', similarity: 0.8 },
      { filePath: 'notes/py.md', content: 'Python', similarity: 0.7 },
    ];
    const ctx = buildRAGContext(results);
    // Should have 2 sources (grouped by file)
    expect(ctx.sources.length).toBe(2);
    // js.md should have best similarity
    const jsSrc = ctx.sources.find(s => s.fileName === 'js.md');
    expect(jsSrc?.similarity).toBe(0.9);
  });
});

describe('buildSystemPrompt', () => {
  it('returns base prompt for empty context', () => {
    const ctx: RAGContext = { text: '', sources: [] };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('知识管理助手');
    expect(prompt).not.toContain('检索到的相关内容');
  });

  it('includes context in prompt', () => {
    const ctx: RAGContext = {
      text: '【test.md】\nSome knowledge content',
      sources: [{ fileName: 'test.md', similarity: 0.9 }],
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('知识管理助手');
    expect(prompt).toContain('检索到的相关内容');
    expect(prompt).toContain('Some knowledge content');
  });
});
