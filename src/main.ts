import { Plugin, TFile, Notice, WorkspaceLeaf } from 'obsidian';
import type { KnowForgeSettings } from './types';
import { DEFAULT_SETTINGS, KnowForgeSettingTab } from './settings';
import { GeminiClient } from './gemini';
import { VectorStore } from './vectorStore';
import { RAGEngine } from './rag';
import { IntakeProcessor } from './intake';
import { ChatView, CHAT_VIEW_TYPE } from './ui/ChatView';

const VECTOR_INDEX_FILE = 'knowforge-data/vector-index.json';

export default class KnowForgePlugin extends Plugin {
  settings: KnowForgeSettings = DEFAULT_SETTINGS;
  geminiClient: GeminiClient | null = null;
  vectorStore: VectorStore = new VectorStore();
  ragEngine: RAGEngine | null = null;
  intakeProcessor: IntakeProcessor | null = null;

  async onload() {
    await this.loadSettings();

    // 初始化 Gemini 客户端
    if (this.settings.geminiApiKey) {
      this.initServices();
    }

    // 注册 Chat View
    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));

    // 注册设置面板
    this.addSettingTab(new KnowForgeSettingTab(this.app, this));

    // Ribbon 图标 — 打开聊天
    this.addRibbonIcon('message-square', 'KnowForge Chat', () => {
      this.activateChatView();
    });

    // 注册命令
    this.addCommand({
      id: 'open-chat',
      name: '打开聊天面板',
      callback: () => this.activateChatView(),
    });

    this.addCommand({
      id: 'process-intake',
      name: '处理 Intake 文件夹',
      callback: () => this.processIntake(),
    });

    this.addCommand({
      id: 'rebuild-index',
      name: '重建向量索引',
      callback: () => this.rebuildIndex(),
    });

    this.addCommand({
      id: 'test-connection',
      name: '测试 Gemini 连接',
      callback: () => this.testConnection(),
    });

    // 加载向量索引
    await this.loadVectorIndex();

    // 监听文件变化（自动处理 intake）
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && this.shouldAutoProcess(file)) {
          // 延迟处理，等文件内容写入完成
          setTimeout(() => this.autoProcessFile(file), 2000);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && this.shouldAutoProcess(file)) {
          setTimeout(() => this.autoProcessFile(file), 2000);
        }
      }),
    );

    console.log('KnowForge plugin loaded');
  }

  onunload() {
    // 保存向量索引
    this.saveVectorIndex();
    console.log('KnowForge plugin unloaded');
  }

  // ===== 初始化 =====

  initServices(): void {
    this.geminiClient = new GeminiClient(
      this.settings.geminiApiKey,
      this.settings.chatModel,
      this.settings.embeddingModel,
    );

    this.ragEngine = new RAGEngine(
      this.vectorStore,
      this.geminiClient,
      this.settings.ragTopK,
      this.settings.ragSimilarityThreshold,
    );

    this.intakeProcessor = new IntakeProcessor(
      this.app.vault,
      this.settings,
      this.geminiClient,
      this.vectorStore,
    );
  }

  // ===== Settings =====

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);

    // 更新服务配置
    if (this.settings.geminiApiKey) {
      if (!this.geminiClient) {
        this.initServices();
      } else {
        this.geminiClient.updateConfig(
          this.settings.geminiApiKey,
          this.settings.chatModel,
          this.settings.embeddingModel,
        );
        this.ragEngine?.updateConfig(
          this.settings.ragTopK,
          this.settings.ragSimilarityThreshold,
        );
        this.intakeProcessor?.updateSettings(this.settings);
      }
    }
  }

  // ===== Chat View =====

  async activateChatView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: CHAT_VIEW_TYPE,
        active: true,
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  // ===== Vector Index =====

  private async loadVectorIndex(): Promise<void> {
    try {
      const file = this.app.vault.getAbstractFileByPath(VECTOR_INDEX_FILE);
      if (file instanceof TFile) {
        const json = await this.app.vault.read(file);
        this.vectorStore.load(json);
        console.log(`KnowForge: 加载了 ${this.vectorStore.getRecordCount()} 条向量记录`);
      }
    } catch (err) {
      console.warn('KnowForge: 无法加载向量索引', err);
    }
  }

  async saveVectorIndex(): Promise<void> {
    if (!this.vectorStore.isDirty()) return;

    try {
      const json = this.vectorStore.serialize();
      const dataFolder = this.settings.dataFolder;

      // 确保数据文件夹存在
      if (!this.app.vault.getAbstractFileByPath(dataFolder)) {
        await this.app.vault.createFolder(dataFolder);
      }

      const file = this.app.vault.getAbstractFileByPath(VECTOR_INDEX_FILE);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, json);
      } else {
        await this.app.vault.create(VECTOR_INDEX_FILE, json);
      }
    } catch (err) {
      console.error('KnowForge: 保存向量索引失败', err);
    }
  }

  // ===== Intake Processing =====

  private shouldAutoProcess(file: TFile): boolean {
    return (
      this.settings.autoProcess &&
      file.extension === 'md' &&
      file.path.startsWith(this.settings.intakeFolder + '/')
    );
  }

  private async autoProcessFile(file: TFile): Promise<void> {
    if (!this.intakeProcessor || !this.geminiClient) {
      return;
    }
    await this.intakeProcessor.processFile(file);
    await this.saveVectorIndex();
  }

  private async processIntake(): Promise<void> {
    if (!this.intakeProcessor || !this.geminiClient) {
      new Notice('KnowForge: 请先配置 Gemini API Key');
      return;
    }

    new Notice('KnowForge: 开始处理 Intake 文件夹...');
    const count = await this.intakeProcessor.processAll();
    await this.saveVectorIndex();
    new Notice(`KnowForge: 处理完成，共 ${count} 个文件`);
  }

  // ===== Rebuild Index =====

  private async rebuildIndex(): Promise<void> {
    if (!this.geminiClient) {
      new Notice('KnowForge: 请先配置 Gemini API Key');
      return;
    }

    new Notice('KnowForge: 开始重建向量索引...');

    const cardsFolder = this.settings.cardsFolder;
    const files = this.app.vault.getMarkdownFiles().filter(
      f => f.path.startsWith(cardsFolder + '/'),
    );

    let indexed = 0;
    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        await this.vectorStore.indexFile(file.path, content, file.stat.mtime, this.geminiClient);
        indexed++;
      } catch (err) {
        console.warn(`KnowForge: 索引失败 ${file.path}`, err);
      }
    }

    await this.saveVectorIndex();
    new Notice(`KnowForge: 索引重建完成，共 ${indexed} 个文件`);
  }

  // ===== Test Connection =====

  private async testConnection(): Promise<void> {
    if (!this.geminiClient) {
      new Notice('KnowForge: 请先配置 Gemini API Key');
      return;
    }

    new Notice('KnowForge: 测试连接中...');
    const result = await this.geminiClient.testConnection();
    if (result.success) {
      new Notice('KnowForge: Gemini 连接成功!');
    } else {
      new Notice('KnowForge: 连接失败 — ' + (result.error || '未知错误'));
    }
  }
}
