import React, { useState, useEffect } from 'react';
import { LeftSidebar } from './components/LeftSidebar';
import { CenterPanel } from './components/CenterPanel';
import { RightPanel } from './components/RightPanel';
import { BottomPanel } from './components/BottomPanel';
import { DashboardView } from './components/DashboardView';
import { SettingsView } from './components/SettingsView';
import { Conversation, Message, FileNode, Config, Metrics, ExecutionLog, ViewMode } from './types';

export const App: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('chat');
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  
  // Real-time agent status tracker
  const [agentSteps, setAgentSteps] = useState<any[]>([]);

  // Telemetry Metrics
  const [metrics, setMetrics] = useState<Metrics>({
    cpu_usage: 0,
    memory_usage: 0,
    generated_files: 0,
    repo_size: 0,
    ai_requests: 0,
    timestamp: ''
  });
  const [executionHistory, setExecutionHistory] = useState<ExecutionLog[]>([]);

  // Configurations
  const [config, setConfig] = useState<Config>({
    gemini_api_key: '',
    gemini_model: 'gemini-2.5-flash',
    temperature: 0.7,
    max_tokens: 4096,
    theme: 'dark',
    workspace_path: ''
  });

  // ----------------- LIFECYCLE INITIALIZATION -----------------
  useEffect(() => {
    fetchConversations();
    fetchFiles();
    fetchMetrics();
    fetchConfig();
  }, []);

  useEffect(() => {
    if (activeChatId) {
      fetchMessages(activeChatId);
      fetchFiles();
      fetchMetrics();
    } else {
      setMessages([]);
    }
    // Reset agent status lists on session swap
    setAgentSteps([]);
  }, [activeChatId]);

  // ----------------- API ACCESS METHODS -----------------
  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !activeChatId) {
        setActiveChatId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/conversations/${chatId}/history`);
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await fetch(`/api/workspace/files?chat_id=${activeChatId || ''}`);
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      console.error("Failed to load files tree:", e);
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`/api/dashboard/metrics?chat_id=${activeChatId || ''}`);
      const data = await res.json();
      setMetrics(data.metrics);
      setExecutionHistory(data.execution_history);
    } catch (e) {
      console.error("Failed to load dashboard metrics:", e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error("Failed to load configs:", e);
    }
  };

  // ----------------- ACTION HANDLERS -----------------
  const handleNewChat = async () => {
    const newId = `chat_${Date.now()}`;
    const form = new FormData();
    form.append('chat_id', newId);
    form.append('title', 'New Chat Session');
    
    try {
      await fetch('/api/conversations', { method: 'POST', body: form });
      await fetchConversations();
      setActiveChatId(newId);
      setViewMode('chat');
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    try {
      await fetch(`/api/conversations/${chatId}`, { method: 'DELETE' });
      await fetchConversations();
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    } catch (e) {
      console.error("Failed to delete chat:", e);
    }
  };

  const handleSendMessage = async (inputStr: string, mode: 'build' | 'plan' | 'review' = 'build') => {
    let chatId = activeChatId;
    if (!chatId) {
      chatId = `chat_${Date.now()}`;
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('title', inputStr.substring(0, 30) || 'New Chat Session');
      
      try {
        await fetch('/api/conversations', { method: 'POST', body: form });
        await fetchConversations();
        setActiveChatId(chatId);
      } catch (e) {
        console.error("Failed to auto-create conversation:", e);
        alert(`Failed to create conversation: ${e}`);
        return;
      }
    }
    
    // Add user message locally first
    const userMsg: Message = {
      role: 'user',
      content: inputStr,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    setStatusText('Planning execution steps...');
    setAgentSteps([]);

    try {
      // Connect to Streaming API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message: inputStr, mode })
      });

      if (!response.body) {
        throw new Error("No response body.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let finished = false;
      let buffer = '';
      let accumulatedResponseText = '';

      while (!finished) {
        const { value, done } = await reader.read();
        finished = done;
        if (value) {
          buffer += decoder.decode(value, { stream: !finished });
          
          // Split buffer by SSE lines
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || ''; // Keep trailing incomplete block in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6);
              try {
                const payload = JSON.parse(rawData);
                
                // Handle different agent loop events
                if (payload.type === 'status') {
                  setStatusText(payload.status_text);
                } else if (payload.type === 'thought') {
                  setAgentSteps(prev => [...prev, { thought: payload.text }]);
                } else if (payload.type === 'plan') {
                  setAgentSteps(prev => [...prev, { plan: payload.text }]);
                } else if (payload.type === 'tool_call') {
                  setAgentSteps(prev => [...prev, { toolCall: { tool: payload.tool, args: payload.args } }]);
                } else if (payload.type === 'tool_result') {
                  setAgentSteps(prev => [...prev, { toolResult: { tool: payload.tool, result: payload.result } }]);
                  // Refresh workspace tree dynamically when workspace updates occur
                  fetchFiles();
                  fetchMetrics();
                } else if (payload.type === 'content') {
                  accumulatedResponseText += payload.delta;
                  
                  // Dynamically stream assistant responses in chat list
                  setMessages(prev => {
                    const otherMessages = prev.filter((_, idx) => idx !== prev.length - 1 || prev[prev.length - 1].role !== 'assistant');
                    const assistantMsg: Message = {
                      role: 'assistant',
                      content: accumulatedResponseText,
                      timestamp: new Date().toISOString()
                    };
                    // Check if last element was assistant, overwrite it, else push
                    if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
                      return [...otherMessages, assistantMsg];
                    } else {
                      return [...prev, assistantMsg];
                    }
                  });
                } else if (payload.type === 'error') {
                  alert(`Agent Error: ${payload.message}`);
                }
              } catch (err) {
                console.error("JSON parsing error inside event stream:", err);
              }
            }
          }
        }
      }
      
      // Post-process updates
      fetchFiles();
      fetchMetrics();
      fetchConversations(); // Updates title if changed
    } catch (e) {
      alert(`Connection failed: ${e}`);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setStatusText(`Uploading ${file.name}...`);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/workspace/upload?chat_id=${activeChatId || ''}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchFiles();
        fetchMetrics();
      } else {
        alert(`Upload error: ${data.detail}`);
      }
    } catch (e) {
      alert(`Upload failed: ${e}`);
    } finally {
      setLoading(false);
      setStatusText('');
    }
  };

  const handleOpenFile = async (relPath: string): Promise<string> => {
    const res = await fetch(`/api/workspace/file?chat_id=${activeChatId || ''}&rel_path=${encodeURIComponent(relPath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to read file.');
    return data.content;
  };

  const handleSaveFile = async (relPath: string, content: string): Promise<void> => {
    const res = await fetch('/api/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: relPath, content, chat_id: activeChatId || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to write file.');
    fetchFiles();
    fetchMetrics();
  };

  const handleDeleteFile = async (relPath: string): Promise<void> => {
    const res = await fetch(`/api/workspace/file?chat_id=${activeChatId || ''}&rel_path=${encodeURIComponent(relPath)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to delete file.');
    fetchFiles();
    fetchMetrics();
  };

  const handleRenameFile = async (relPath: string, newRelPath: string): Promise<void> => {
    const res = await fetch('/api/workspace/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel_path: relPath, new_rel_path: newRelPath, chat_id: activeChatId || '' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to rename.');
    fetchFiles();
  };

  const handleDownloadWorkspace = () => {
    window.open(`/api/workspace/download?chat_id=${activeChatId || ''}`, '_blank');
  };

  const handleSaveConfig = async (updated: Partial<Config>) => {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    if (res.ok) {
      fetchConfig();
    } else {
      throw new Error("Failed to save configuration.");
    }
  };

  return (
    <div className="h-screen w-screen flex bg-[#1A1A1A] text-dark-text overflow-hidden">
      
      {/* 1. Collapsible Sidebar */}
      <LeftSidebar
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        conversations={conversations}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* 2. Main Viewport Panel */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Dynamic center panels based on active view navigation */}
        <div className="flex-1 flex overflow-hidden">
          
          {viewMode === 'chat' && (
            <CenterPanel
              messages={messages}
              loading={loading}
              statusText={statusText}
              agentSteps={agentSteps}
              onSendMessage={handleSendMessage}
              onFileUpload={handleFileUpload}
            />
          )}

          {viewMode === 'dashboard' && (
            <DashboardView
              metrics={metrics}
              executionHistory={executionHistory}
              onRefresh={fetchMetrics}
            />
          )}

          {viewMode === 'settings' && (
            <SettingsView
              config={config}
              onSaveConfig={handleSaveConfig}
            />
          )}

          {/* Right workspace file tree explorer visible in chat workspace */}
          {viewMode === 'chat' && (
            <RightPanel
              files={files}
              onOpenFile={handleOpenFile}
              onSaveFile={handleSaveFile}
              onDeleteFile={handleDeleteFile}
              onRenameFile={handleRenameFile}
              onRefreshFiles={fetchFiles}
              onDownloadWorkspace={handleDownloadWorkspace}
            />
          )}
        </div>

        {/* 3. Bottom Terminal Panel */}
        <BottomPanel wsUrl={`/ws/terminal?chat_id=${activeChatId || 'default'}`} />

      </div>
    </div>
  );
};

export default App;
