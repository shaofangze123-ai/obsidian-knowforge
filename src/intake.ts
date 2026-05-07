import { TFile, Vault, Notice } from 'obsidian';
import type { KnowForgeSettings, KnowledgeCardMeta } from './types';
import type { LLMClient } from './llm';
import type { VectorStore } from './vectorStore';
import { parseFrontmatter, stripFrontmatter, generateFrontmatter, cleanTags } from './frontmatter';

const PROCESS_PROMPT = `你是一个知识卡片生成器。请将以下剪藏内容提炼成一张结构化的知识卡片。

要求：
1. 提取核心观点，去除广告和无关内容
2. 用清晰、简洁的中文重新组织
3. 保留关键代码片段（如有）
4. 生成 3-5 个标签（用英文逗号分隔）
5. 生成一个简洁的标题

输出格式（严格遵守）：
TITLE: <标题>
TAGS: <tag1, tag2, tag3>
CONTENT:
<正文内容，使用 Markdown 格式>

---
原文内容：
`;

/**
 * Intake 处理器
 * 监听 intake 文件夹，将 raw 剪藏加工为知识卡片
 */
export class IntakeProcessor {
  private vault: Vault;
  private settings: KnowForgeSettings;
  private llm: LLMClient;
  private vectorStore: VectorStore;
  private processing = new Set<string>();

  constructor(
    vault: Vault,
    settings: KnowForgeSettings,
    llm: LLMClient,
    vectorStore: VectorStore,
  ) {
    this.vault = vault;
    this.settings = settings;
    this.llm = llm;
    this.vectorStore = vectorStore;
  }

  updateSettings(settings: KnowForgeSettings): void {
    this.settings = settings;
  }

  /**
   * 处理单个 intake 文件
   */
  async processFile(file: TFile): Promise<void> {
    if (this.processing.has(file.path)) return;
    this.processing.add(file.path);

    try {
      const content = await this.vault.read(file);
      const frontmatter = parseFrontmatter(content);

      // 跳过已处理的文件
      if (frontmatter.status === 'processed' || frontmatter.status === 'processing') {
        return;
      }

      // 标记为处理中
      await this.markStatus(file, content, 'processing');

      const body = stripFrontmatter(content).trim();
      if (!body) {
        await this.markStatus(file, content, 'error');
        return;
      }

      // 调用 LLM 生成知识卡片
      const result = await this.llm.chat(
        [{ role: 'user', content: PROCESS_PROMPT + body }],
        0.3,
      );

      const card = parseCardResponse(result);
      if (!card) {
        await this.markStatus(file, content, 'error');
        new Notice('KnowForge: 卡片生成失败 — ' + file.name);
        return;
      }

      // 生成知识卡片文件
      const cardMeta: KnowledgeCardMeta = {
        title: card.title,
        type: 'card',
        status: 'active',
        tags: cleanTags(card.tags),
        source_url: frontmatter.source_url || frontmatter.url || '',
        source_title: frontmatter.source_title || frontmatter.title || file.basename,
        created: new Date().toISOString().split('T')[0],
        modified: new Date().toISOString().split('T')[0],
      };

      const cardContent = generateFrontmatter(cardMeta) + '\n\n' + card.content;
      const cardFileName = sanitizeFileName(card.title) + '.md';
      const cardPath = `${this.settings.cardsFolder}/${cardFileName}`;

      // 确保目标文件夹存在
      await this.ensureFolder(this.settings.cardsFolder);

      // 写入卡片文件
      const existing = this.vault.getAbstractFileByPath(cardPath);
      if (existing instanceof TFile) {
        await this.vault.modify(existing, cardContent);
      } else {
        await this.vault.create(cardPath, cardContent);
      }

      // 标记原文件为已处理
      await this.markStatus(file, content, 'processed');

      // 索引到向量存储
      await this.vectorStore.indexFile(cardPath, card.content, Date.now(), this.llm);

      new Notice('KnowForge: 已生成知识卡片 — ' + card.title);
    } catch (err: any) {
      console.error('KnowForge intake error:', err);
      new Notice('KnowForge: 处理失败 — ' + err.message);
      try {
        const content = await this.vault.read(file);
        await this.markStatus(file, content, 'error');
      } catch {
        // ignore secondary error
      }
    } finally {
      this.processing.delete(file.path);
    }
  }

  /**
   * 扫描并处理 intake 文件夹中的所有文件
   */
  async processAll(): Promise<number> {
    const folder = this.vault.getAbstractFileByPath(this.settings.intakeFolder);
    if (!folder) return 0;

    const files = this.vault.getMarkdownFiles().filter(
      f => f.path.startsWith(this.settings.intakeFolder + '/'),
    );

    let processed = 0;
    for (const file of files) {
      const content = await this.vault.read(file);
      const fm = parseFrontmatter(content);
      if (!fm.status || fm.status === 'raw') {
        await this.processFile(file);
        processed++;
      }
    }
    return processed;
  }

  private async markStatus(file: TFile, originalContent: string, status: string): Promise<void> {
    const fm = parseFrontmatter(originalContent);
    fm.status = status;
    const body = stripFrontmatter(originalContent);
    const newContent = generateFrontmatter(fm) + body;
    await this.vault.modify(file, newContent);
  }

  private async ensureFolder(path: string): Promise<void> {
    const existing = this.vault.getAbstractFileByPath(path);
    if (!existing) {
      await this.vault.createFolder(path);
    }
  }
}

// ===== 纯函数工具 (可独立测试) =====

export interface ParsedCard {
  title: string;
  tags: string[];
  content: string;
}

/**
 * 解析 LLM 返回的卡片格式
 */
export function parseCardResponse(response: string): ParsedCard | null {
  if (!response) return null;

  const titleMatch = response.match(/TITLE:\s*(.+)/);
  const tagsMatch = response.match(/TAGS:\s*(.+)/);
  const contentMatch = response.match(/CONTENT:\s*\n([\s\S]+)/);

  if (!titleMatch || !contentMatch) return null;

  const title = titleMatch[1].trim();
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean)
    : [];
  const content = contentMatch[1].trim();

  if (!title || !content) return null;

  return { title, tags, content };
}

/**
 * 文件名清洗
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}
