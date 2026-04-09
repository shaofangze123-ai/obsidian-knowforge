import { Plugin } from 'obsidian';
import { KnowForgeSettings } from './types';
import { DEFAULT_SETTINGS, KnowForgeSettingTab } from './settings';

export default class KnowForgePlugin extends Plugin {
  settings: KnowForgeSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new KnowForgeSettingTab(this.app, this));
    console.log('KnowForge plugin loaded');
  }

  onunload() {
    console.log('KnowForge plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
