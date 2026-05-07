import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import type KnowForgePlugin from '../main';
import type { ChatMessage, Conversation } from '../types';
import { buildSystemPrompt } from '../rag';

export const CHAT_VIEW_TYPE = 'knowforge-chat';

// ===== Obsidian ItemView =====

export class ChatView extends ItemView {
  private root: Root | null = null;
  private plugin: KnowForgePlugin;

  constructor(leaf: WorkspaceLeaf, plugin: KnowForgePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return CHAT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'KnowForge Chat';
  }

  getIcon(): string {
    return 'message-square';
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('knowforge-chat-container');

    this.root = createRoot(container);
    this.root.render(
      <ChatApp plugin={this.plugin} />
    );
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}

// ===== React Components =====

interface ChatAppProps {
  plugin: KnowForgePlugin;
}

function ChatApp({ plugin }: ChatAppProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [streaming, setStreaming] = React.useState(false);
  const [ragSources, setRagSources] = React.useState<{ fileName: string; similarity: number }[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming) return;

    if (!plugin.llmClient) {
      setMessages(prev => [...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: '请先在设置中配置 API Key，然后重启 Obsidian。' },
      ]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);
    setRagSources([]);

    try {
      // 获取当前活跃笔记内容
      let activeNoteContext = '';
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile && activeFile.extension === 'md') {
        const content = await plugin.app.vault.read(activeFile);
        activeNoteContext = `\n\n当前打开的笔记「${activeFile.basename}」内容如下：\n\n${content}`;
      }

      // RAG 检索
      let systemPrompt = '你是一个知识管理助手，帮助用户整理和理解他们的知识库。请使用中文回答。';

      if (plugin.settings.ragEnabled && plugin.ragEngine) {
        const ragCtx = await plugin.ragEngine.retrieve(text);
        systemPrompt = buildSystemPrompt(ragCtx);
        if (ragCtx.sources.length > 0) {
          setRagSources(ragCtx.sources);
        }
      }

      // 注入当前笔记上下文
      if (activeNoteContext) {
        systemPrompt += activeNoteContext;
      }

      // 构建消息列表（含系统提示）
      const contextMessages: ChatMessage[] = [
        { role: 'user', content: systemPrompt },
        { role: 'assistant', content: '好的，我会根据知识库内容来回答你的问题。' },
      ];

      // 保留最近 N 轮对话
      const maxCtx = plugin.settings.maxContextMessages;
      const recentMessages = newMessages.slice(-maxCtx);
      contextMessages.push(...recentMessages);

      // 流式响应
      const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
      setMessages(prev => [...prev, assistantMsg]);

      const stream = plugin.llmClient!.chatStream(
        contextMessages,
        plugin.settings.temperature,
      );

      for await (const chunk of stream) {
        assistantMsg.content += chunk;
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg };
          return updated;
        });
      }

      // 如果流式返回空内容，fallback 到非流式
      if (!assistantMsg.content) {
        const reply = await plugin.llmClient!.chat(
          contextMessages,
          plugin.settings.temperature,
        );
        assistantMsg.content = reply || '抱歉，我无法生成回复。';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg };
          return updated;
        });
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `出错了: ${err.message}`,
      };
      setMessages(prev => [...prev.slice(0, -1), errorMsg]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setRagSources([]);
  };

  return (
    <div className="knowforge-chat">
      {/* Header */}
      <div className="knowforge-chat-header">
        <span className="knowforge-chat-title">KnowForge Chat</span>
        <button
          className="knowforge-btn-clear"
          onClick={handleClear}
          title="清空对话"
        >
          清空
        </button>
      </div>

      {/* RAG Sources */}
      {ragSources.length > 0 && (
        <div className="knowforge-rag-sources">
          <span className="knowforge-rag-label">参考来源:</span>
          {ragSources.map((s, i) => (
            <span key={i} className="knowforge-rag-source">
              {s.fileName} ({Math.round(s.similarity * 100)}%)
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="knowforge-messages">
        {messages.length === 0 && (
          <div className="knowforge-empty">
            <p>向 KnowForge 提问，它会参考你的知识库来回答。</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {streaming && (
          <div className="knowforge-typing">
            <span className="knowforge-dot" />
            <span className="knowforge-dot" />
            <span className="knowforge-dot" />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="knowforge-input-area">
        <textarea
          className="knowforge-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          rows={2}
          disabled={streaming}
        />
        <button
          className="knowforge-btn-send"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
        >
          {streaming ? '...' : '发送'}
        </button>
      </div>
    </div>
  );
}

// ===== Message Bubble =====

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`knowforge-msg ${isUser ? 'knowforge-msg-user' : 'knowforge-msg-ai'}`}>
      <div className="knowforge-msg-content">
        {message.content || '...'}
      </div>
    </div>
  );
}
