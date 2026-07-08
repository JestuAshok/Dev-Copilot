export interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileNode[];
  size?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

export interface Config {
  gemini_api_key: string;
  gemini_model: string;
  temperature: number;
  max_tokens: number;
  theme: string;
  workspace_path: string;
}

export interface ExecutionLog {
  id: number;
  command: string;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  timestamp: string;
}

export interface Metrics {
  cpu_usage: number;
  memory_usage: number;
  generated_files: number;
  repo_size: number;
  ai_requests: number;
  timestamp: string;
}

export type ViewMode = 'chat' | 'dashboard' | 'settings';
