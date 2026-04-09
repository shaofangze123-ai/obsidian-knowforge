import { Plugin } from 'obsidian';

export default class KnowForgePlugin extends Plugin {
  async onload() {
    console.log('KnowForge plugin loaded');
  }

  onunload() {
    console.log('KnowForge plugin unloaded');
  }
}
