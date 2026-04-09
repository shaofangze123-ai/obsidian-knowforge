// ===== Chat 层 =====

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ===== Knowledge 层 =====

export interface KnowledgeCardMeta {
  title: string;
  type: 'card';
  status: 'active' | 'archived';
  tags: string[];
  source_url: string;
  source_title: string;
  created: string;
  modified: string;
}

export interface IntakeFile {
  path: string;
  mtime: number;
  status: 'raw' | 'processing' | 'processed' | 'error';
}

// ===== Vector 层 =====

export interface VectorRecord {
  filePath: string;
  content: string;
  chunkIndex: number;
  vector: number[];
  mtime: number;
}

export interface VectorIndex {
  version: number;
  embeddingModel: string;
  dimensions: number;
  records: VectorRecord[];
}

export interface SearchResult {
  filePath: string;
  content: string;
  similarity: number;
}

// ===== RAG 层 =====

export interface RAGContext {
  text: string;
  sources: { fileName: string; similarity: number }[];
}

// ===== Settings =====

export interface KnowForgeSettings {
  geminiApiKey: string;
  chatModel: string;
  embeddingModel: string;
  intakeFolder: string;
  cardsFolder: string;
  dataFolder: string;
  autoProcess: boolean;
  ragEnabled: boolean;
  ragTopK: number;
  ragSimilarityThreshold: number;
  maxContextMessages: number;
  temperature: number;
}
