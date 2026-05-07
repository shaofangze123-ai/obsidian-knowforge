import { App, PluginSettingTab, Setting } from 'obsidian';
import type KnowForgePlugin from './main';
import type { KnowForgeSettings } from './types';

export const DEFAULT_SETTINGS: KnowForgeSettings = {
  apiBaseUrl: 'https://ai.opendoor.cn',
  apiKey: '',
  chatModel: 'gpt-4.1-mini',
  embeddingModel: 'text-embedding-3-small',
  intakeFolder: 'KF-Intake',
  cardsFolder: 'KF-Cards',
  dataFolder: 'knowforge-data',
  autoProcess: true,
  ragEnabled: true,
  ragTopK: 5,
  ragSimilarityThreshold: 0.3,
  maxContextMessages: 20,
  temperature: 0.7,
};

export class KnowForgeSettingTab extends PluginSettingTab {
  plugin: KnowForgePlugin;

  constructor(app: App, plugin: KnowForgePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'KnowForge 设置' });

    new Setting(containerEl)
      .setName('API 地址')
      .setDesc('OpenAI 兼容 API 的基础地址')
      .addText(text => text
        .setPlaceholder('https://api.openai.com')
        .setValue(this.plugin.settings.apiBaseUrl)
        .onChange(async (value) => {
          this.plugin.settings.apiBaseUrl = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('API 密钥')
      .addText(text => text
        .setPlaceholder('sk-...')
        .setValue(this.plugin.settings.apiKey)
        .onChange(async (value) => {
          this.plugin.settings.apiKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Chat 模型')
      .setDesc('聊天模型名称')
      .addText(text => text
        .setValue(this.plugin.settings.chatModel)
        .onChange(async (value) => {
          this.plugin.settings.chatModel = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Embedding 模型')
      .setDesc('向量嵌入模型名称（留空则禁用 RAG）')
      .addText(text => text
        .setValue(this.plugin.settings.embeddingModel)
        .onChange(async (value) => {
          this.plugin.settings.embeddingModel = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Intake 文件夹')
      .setDesc('Web Clipper 剪藏落地目录')
      .addText(text => text
        .setValue(this.plugin.settings.intakeFolder)
        .onChange(async (value) => {
          this.plugin.settings.intakeFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('知识卡片文件夹')
      .setDesc('加工后的知识卡片存储目录')
      .addText(text => text
        .setValue(this.plugin.settings.cardsFolder)
        .onChange(async (value) => {
          this.plugin.settings.cardsFolder = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('自动处理')
      .setDesc('新剪藏自动编译为知识卡片')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoProcess)
        .onChange(async (value) => {
          this.plugin.settings.autoProcess = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('RAG 检索')
      .setDesc('聊天时自动检索知识库')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.ragEnabled)
        .onChange(async (value) => {
          this.plugin.settings.ragEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('检索结果数量 (Top-K)')
      .setDesc('每次检索返回的知识片段数')
      .addSlider(slider => slider
        .setLimits(1, 10, 1)
        .setValue(this.plugin.settings.ragTopK)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.ragTopK = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('LLM 创造性 (0=精确, 1=创造)')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.1)
        .setValue(this.plugin.settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.temperature = value;
          await this.plugin.saveSettings();
        }));
  }
}
