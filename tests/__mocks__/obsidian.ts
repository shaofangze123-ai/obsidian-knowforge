// tests/__mocks__/obsidian.ts
export const requestUrl = jest.fn();
export class Plugin {}
export class PluginSettingTab {}
export class Setting {
  setName() { return this; }
  setDesc() { return this; }
  addText() { return this; }
  addToggle() { return this; }
  addSlider() { return this; }
}
