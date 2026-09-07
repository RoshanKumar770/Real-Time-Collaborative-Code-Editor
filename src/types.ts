export interface CursorPosition {
  line: number;
  ch: number;
}

export interface TextSelection {
  startLine: number;
  startCh: number;
  endLine: number;
  endCh: number;
}

export interface UserPresence {
  id: string;
  socketId: string;
  username: string;
  color: string;
  cursor?: CursorPosition | null;
  selection?: TextSelection | null;
  activeFileId: string;
  lastActive: number;
  isTyping?: boolean;
}

export type SupportedLanguage = 'javascript' | 'typescript' | 'python' | 'html' | 'css' | 'json' | 'markdown';

export interface CodeFile {
  id: string;
  name: string;
  language: SupportedLanguage;
  content: string;
  version: number;
  lastModifiedBy?: string;
  lastModifiedAt?: number;
}

export interface VersionSnapshot {
  id: string;
  versionNumber: number;
  timestamp: number;
  authorName: string;
  authorColor: string;
  commitMessage: string;
  filesSnapshot: Record<string, string>; // fileId -> content
  fileNames: Record<string, string>;
  activeFileId: string;
  changeSummary: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  userColor: string;
  text: string;
  timestamp: number;
  type: 'chat' | 'system';
}

export interface RoomState {
  id: string;
  name: string;
  files: CodeFile[];
  activeFileId: string;
  users: UserPresence[];
  versionHistory: VersionSnapshot[];
  chatMessages: ChatMessage[];
  syncVersion: number;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  exitCode: number;
  timestamp: number;
}

export interface CodeAnalysis {
  lineCount: number;
  characterCount: number;
  tokenCount: number;
  functionCount: number;
  estimatedComplexity: 'Low' | 'Medium' | 'High';
  syntaxValid: boolean;
  diagnostics: Array<{
    line: number;
    message: string;
    severity: 'info' | 'warning' | 'error';
  }>;
}
