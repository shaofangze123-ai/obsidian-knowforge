import { requestUrl } from 'obsidian';
import type { ChatMessage } from './types';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// ===== 响应解析 (可独立测试) =====

export function parseGeminiChatResponse(response: any): string {
  const candidates = response?.candidates;
  if (!candidates || candidates.length === 0) return '';
  const parts = candidates[0]?.content?.parts;
  if (!parts || parts.length === 0) return '';
  return parts.map((p: any) => p.text || '').join('');
}

export function parseGeminiEmbeddingResponse(response: any): number[] {
  return response?.embedding?.values || [];
}

export function parseGeminiBatchEmbeddingResponse(response: any): number[][] {
  const embeddings = response?.embeddings;
  if (!embeddings) return [];
  return embeddings.map((e: any) => e.values || []);
}

// ===== Gemini 客户端 =====

export class GeminiClient {
  private apiKey: string;
  private chatModel: string;
  private embeddingModel: string;

  constructor(apiKey: string, chatModel: string, embeddingModel: string) {
    this.apiKey = apiKey;
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  updateConfig(apiKey: string, chatModel: string, embeddingModel: string) {
    this.apiKey = apiKey;
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  private url(model: string, method: string): string {
    return `${GEMINI_BASE}/models/${model}:${method}?key=${this.apiKey}`;
  }

  /**
   * 聊天完成 (非流式)
   */
  async chat(messages: ChatMessage[], temperature: number): Promise<string> {
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const response = await requestUrl({
      url: this.url(this.chatModel, 'generateContent'),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature },
      }),
    });

    return parseGeminiChatResponse(response.json);
  }

  /**
   * 聊天完成 (流式) — 返回 AsyncGenerator
   */
  async *chatStream(messages: ChatMessage[], temperature: number): AsyncGenerator<string> {
    const contents = messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const url = this.url(this.chatModel, 'streamGenerateContent') + '&alt=sse';

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          const text = parseGeminiChatResponse(json);
          if (text) yield text;
        } catch {
          // skip malformed JSON
        }
      }
    }
  }

  /**
   * 单条文本 Embedding
   */
  async embed(text: string): Promise<number[]> {
    const response = await requestUrl({
      url: this.url(this.embeddingModel, 'embedContent'),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    return parseGeminiEmbeddingResponse(response.json);
  }

  /**
   * 批量 Embedding (最多 100 条)
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length === 1) {
      const vec = await this.embed(texts[0]);
      return [vec];
    }

    const requests = texts.map(text => ({
      model: `models/${this.embeddingModel}`,
      content: { parts: [{ text: text.slice(0, 500) }] },
    }));

    // 分批，每批最多 100 条
    const batchSize = 100;
    const allVectors: number[][] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const response = await requestUrl({
        url: this.url(this.embeddingModel, 'batchEmbedContents'),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests: batch }),
      });
      const vectors = parseGeminiBatchEmbeddingResponse(response.json);
      allVectors.push(...vectors);
    }

    return allVectors;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.chat(
        [{ role: 'user', content: 'Hi' }],
        0
      );
      return { success: result.length > 0 };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
