import type { SearchResult, RAGContext } from './types';
import type { VectorStore } from './vectorStore';
import type { GeminiClient } from './gemini';

/**
 * RAG 上下文组装器
 * 将用户查询通过向量检索，组装为 LLM 可用的上下文
 */
export class RAGEngine {
  private vectorStore: VectorStore;
  private gemini: GeminiClient;
  private topK: number;
  private threshold: number;

  constructor(
    vectorStore: VectorStore,
    gemini: GeminiClient,
    topK = 5,
    threshold = 0.3,
  ) {
    this.vectorStore = vectorStore;
    this.gemini = gemini;
    this.topK = topK;
    this.threshold = threshold;
  }

  updateConfig(topK: number, threshold: number): void {
    this.topK = topK;
    this.threshold = threshold;
  }

  /**
   * 检索并组装 RAG 上下文
   */
  async retrieve(query: string): Promise<RAGContext> {
    const results = await this.vectorStore.search(
      query,
      this.gemini,
      this.topK,
      this.threshold,
    );

    return buildRAGContext(results);
  }
}

/**
 * 从搜索结果构建 RAG 上下文（纯函数，可独立测试）
 */
export function buildRAGContext(results: SearchResult[]): RAGContext {
  if (results.length === 0) {
    return { text: '', sources: [] };
  }

  // 去重：同一文件只保留最高相似度的片段
  const byFile = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = byFile.get(r.filePath) || [];
    existing.push(r);
    byFile.set(r.filePath, existing);
  }

  const contextParts: string[] = [];
  const sources: { fileName: string; similarity: number }[] = [];

  for (const [filePath, chunks] of byFile) {
    const fileName = filePath.split('/').pop() || filePath;
    const bestSimilarity = Math.max(...chunks.map(c => c.similarity));
    const combinedContent = chunks.map(c => c.content).join('\n\n');

    contextParts.push(`【${fileName}】\n${combinedContent}`);
    sources.push({ fileName, similarity: bestSimilarity });
  }

  return {
    text: contextParts.join('\n\n---\n\n'),
    sources: sources.sort((a, b) => b.similarity - a.similarity),
  };
}

/**
 * 构建带 RAG 上下文的系统提示
 */
export function buildSystemPrompt(ragContext: RAGContext): string {
  if (!ragContext.text) {
    return '你是一个知识管理助手，帮助用户整理和理解他们的知识库。请使用中文回答。';
  }

  return `你是一个知识管理助手，帮助用户整理和理解他们的知识库。请使用中文回答。

以下是从用户知识库中检索到的相关内容，请参考这些信息来回答用户的问题：

${ragContext.text}

注意：
- 优先使用上述知识库内容回答
- 如果知识库内容不足以回答，可以结合你的通用知识
- 引用来源时使用 [[文件名]] 格式`;
}
