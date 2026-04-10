# KnowForge — Obsidian 知识锻造插件

将 Web Clipper 剪藏通过 Gemini AI 自动编译为结构化知识卡片，内置向量检索（RAG）和智能问答。

## 功能

- **Intake 自动处理** — 监听剪藏文件夹，自动调用 Gemini 提炼核心内容、生成标签，输出为规范的知识卡片
- **向量检索（RAG）** — 知识卡片自动分块、Embedding 索引，聊天时自动检索相关知识
- **智能问答** — 内置 Chat 面板，流式响应，引用知识库来源回答问题
- **Frontmatter 管理** — 自动维护知识卡片的元数据（标题、标签、来源、状态等）

## 快速开始

### 1. 安装

```bash
git clone https://github.com/shaofangze123-ai/obsidian-knowforge.git
cd obsidian-knowforge
npm install
npm run build
```

将构建产物（`main.js`、`manifest.json`、`styles.css`）复制到 Obsidian 插件目录：

```
<你的 Vault>/.obsidian/plugins/knowforge/
```

### 2. 配置

在 Obsidian 设置 → KnowForge 中填入：

| 设置项 | 说明 | 默认值 |
|--------|------|--------|
| Gemini API Key | [Google AI Studio](https://aistudio.google.com/apikey) 获取 | — |
| Chat 模型 | 聊天用模型 | `gemini-2.0-flash` |
| Embedding 模型 | 向量嵌入模型 | `text-embedding-004` |
| Intake 文件夹 | Web Clipper 剪藏落地目录 | `KF-Intake` |
| 知识卡片文件夹 | 加工后的卡片目录 | `KF-Cards` |
| 自动处理 | 新剪藏自动编译 | 开启 |
| RAG 检索 | 聊天时检索知识库 | 开启 |
| Top-K | 每次检索返回的片段数 | 5 |
| Temperature | LLM 创造性（0=精确, 1=创造） | 0.7 |

### 3. 使用

1. **剪藏** — 用 Obsidian Web Clipper 将网页保存到 `KF-Intake` 文件夹
2. **自动处理** — 插件自动检测新文件，调用 Gemini 生成知识卡片到 `KF-Cards`
3. **聊天** — 点击侧边栏的 💬 图标打开 Chat 面板，向知识库提问

### 命令面板

| 命令 | 说明 |
|------|------|
| `KnowForge: 打开聊天面板` | 打开/聚焦 Chat 面板 |
| `KnowForge: 处理 Intake 文件夹` | 手动批量处理所有待处理文件 |
| `KnowForge: 重建向量索引` | 重新索引所有知识卡片 |
| `KnowForge: 测试 Gemini 连接` | 验证 API Key 是否有效 |

## 工作流程

```
Web Clipper 剪藏 (.md)
        ↓
   KF-Intake 文件夹
        ↓  (Gemini 提炼)
   KF-Cards 知识卡片
        ↓  (Embedding)
     向量索引
        ↓  (RAG 检索)
   Chat 智能问答
```

## 知识卡片格式

```markdown
---
title: "React Hooks 入门"
type: "card"
status: "active"
tags:
  - react
  - hooks
  - frontend
source_url: "https://example.com/article"
source_title: "原文标题"
created: "2026-04-10"
modified: "2026-04-10"
---

## 核心内容

提炼后的知识正文...
```

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发构建（watch 模式）
npm run build      # 生产构建
npm test           # 运行测试（54 个用例）
```

## 技术栈

- TypeScript + React 18
- Obsidian Plugin API
- Google Gemini API（Chat + Embedding）
- 内存向量存储 + 余弦相似度检索
- esbuild 构建
- Jest 测试

## 许可

MIT
