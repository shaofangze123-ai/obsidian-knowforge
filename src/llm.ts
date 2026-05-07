import { requestUrl } from 'obsidian';
import type { ChatMessage } from './types';

// ===== 响应解析 (可独立测试) =====

export function parseChatResponse(response: any): string {
  const choices = response?.choices;
  if (!choices || choices.length === 0) return '';
  return choices[0]?.message?.content || '';
}

export function parseEmbeddingResponse(response: any): number[] {
  const data = response?.data;
  if (!data || data.length === 0) return [];
  return data[0]?.embedding || [];
}

export function parseBatchEmbeddingResponse(response: any): number[][] {
  const data = response?.data;
  if (!data) return [];
  // OpenAI 返回的 data 按 index 排序
  const sorted = [...data].sort((a: any, b: any) => a.index - b.index);
  return sorted.map((d: any) => d.embedding || []);
}

// ===== LLM 客户端 (OpenAI 兼容) =====

export class LLMClient {
  private baseUrl: string;
  private apiKey: string;
  private chatModel: string;
  private embeddingModel: string;

  constructor(baseUrl: string, apiKey: string, chatModel: string, embeddingModel: string) {
    // 去掉末尾斜杠和 /v1
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    this.apiKey = apiKey;
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  updateConfig(baseUrl: string, apiKey: string, chatModel: string, embeddingModel: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
    this.apiKey = apiKey;
    this.chatModel = chatModel;
    this.embeddingModel = embeddingModel;
  }

  private url(endpoint: string): string {
    return `${this.baseUrl}/v1${endpoint}`;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
  }

  /**
   * 聊天完成 (非流式)
   */
  async chat(messages: ChatMessage[], temperature: number): Promise<string> {
    const response = await requestUrl({
      url: this.url('/chat/completions'),
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
      }),
    });

    return parseChatResponse(response.json);
  }

  /**
   * 聊天完成 (流式) — 返回 AsyncGenerator
   */
  async *chatStream(messages: ChatMessage[], temperature: number): AsyncGenerator<string> {
    const response = await fetch(this.url('/chat/completions'), {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.chatModel,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
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
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
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
      url: this.url('/embeddings'),
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    return parseEmbeddingResponse(response.json);
  }

  /**
   * 批量 Embedding
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (texts.length === 1) {
      const vec = await this.embed(texts[0]);
      return [vec];
    }

    const batchSize = 100;
    const allVectors: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => t.slice(0, 500));
      const response = await requestUrl({
        url: this.url('/embeddings'),
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          model: this.embeddingModel,
          input: batch,
        }),
      });
      const vectors = parseBatchEmbeddingResponse(response.json);
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
        0,
      );
      return { success: result.length > 0 };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
