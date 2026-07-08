import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TermIcon, Trash2, EyeOff, Eye, Plus, X } from 'lucide-react';

interface BottomPanelProps {
  wsUrl: string;
}

interface TerminalPaneProps {
  wsUrl: string;
  paneIndex: number;
  onClose: () => void;
}

const TerminalPane: React.FC<TerminalPaneProps> = ({ wsUrl, paneIndex, onClose }) => {
  const [terminalBuffer, setTerminalBuffer] = useState<string>('Initializing local shell...\r\n');
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const socketAddress = `${protocol}//${host}${wsUrl}`;

    logger.info(`Connecting terminal websocket: ${socketAddress}`);
    const ws = new WebSocket(socketAddress);
    socketRef.current = ws;

    ws.onopen = () => {
      setTerminalBuffer(prev => prev + 'Shell connected. Type commands below.\r\n\r\n');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'output') {
          const rawData = payload.data;
          setTerminalBuffer(prev => {
            if (rawData === '\b') return prev.slice(0, -1);
            return prev + rawData;
          });
        }
      } catch {
        setTerminalBuffer(prev => prev + event.data);
      }
    };

    ws.onclose = () => {
      setTerminalBuffer(prev => prev + '\r\nShell disconnected.');
    };

    ws.onerror = (err) => {
      setTerminalBuffer(prev => prev + `\r\nTerminal error: ${err}`);
    };

    return () => { ws.close(); };
  }, [wsUrl]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalBuffer]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;
    e.preventDefault();

    let toSend = '';
    if (e.key === 'Enter') toSend = '\r\n';
    else if (e.key === 'Backspace') toSend = '\b';
    else if (e.key === 'Tab') toSend = '\t';
    else if (e.key === 'Escape') toSend = '\u001b';
    else if (e.key.length === 1) {
      toSend = e.key;
      if (e.ctrlKey && e.key.toLowerCase() === 'c') toSend = '\u0003';
    }

    if (toSend) {
      socketRef.current.send(JSON.stringify({ type: 'input', data: toSend }));
    }
  };

  if (!isVisible) {
    return (
      <div className="border border-white/8 rounded-xl bg-[#161616] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TermIcon size={12} className="text-brand-mint" />
          <span className="text-xs text-neutral-400">Terminal {paneIndex} hidden</span>
        </div>
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-white rounded hover:bg-white/5 transition-all cursor-pointer"
          title="Show terminal"
        >
          <Eye size={12} />
          <span>Show</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      tabIndex={0}
      className={`border border-white/8 rounded-xl bg-[#141414] flex flex-col focus:outline-none flex-shrink-0 relative transition-all ${
        isFocused ? 'ring-1 ring-white/8' : ''
      }`}
    >
      <div className="h-9 px-3 border-b border-dark-border flex items-center justify-between bg-[#181818] rounded-t-xl">
        <div className="flex items-center gap-2">
          <TermIcon size={13} className="text-brand-mint" />
          <span className="text-xs font-medium text-neutral-400">Terminal {paneIndex}</span>
          {isFocused && (
            <span className="text-[9px] text-brand-mint/70 bg-brand-mint/8 px-1.5 py-0.5 rounded animate-pulse">Active</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:text-white rounded hover:bg-white/5 text-neutral-500 transition-all cursor-pointer"
            title="Hide terminal"
          >
            <EyeOff size={12} />
          </button>
          <button
            onClick={() => setTerminalBuffer('')}
            className="p-1 hover:text-white rounded hover:bg-white/5 text-neutral-500 transition-all cursor-pointer"
            title="Clear"
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:text-white rounded hover:bg-white/5 text-neutral-500 transition-all cursor-pointer"
            title="Close terminal"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      <div
        onClick={() => containerRef.current?.focus()}
        className="h-44 p-4 overflow-y-auto font-mono text-xs text-white leading-relaxed overflow-x-auto whitespace-pre-wrap select-text bg-[#111111] rounded-b-xl"
      >
        <pre className="inline">{terminalBuffer}</pre>
        <span className="w-1.5 h-3.5 bg-white inline-block cursor-blink ml-0.5 align-middle" />
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};

export const BottomPanel: React.FC<BottomPanelProps> = ({ wsUrl }) => {
  const [terminalIds, setTerminalIds] = useState<number[]>([1]);
  const [isVisible, setIsVisible] = useState(true);

  const addTerminal = () => {
    setTerminalIds(prev => [...prev, Date.now()]);
  };

  const removeTerminal = (id: number) => {
    setTerminalIds(prev => prev.filter(item => item !== id));
  };

  if (!isVisible) {
    return (
      <div className="border-t border-dark-border bg-[#141414] flex items-center justify-between px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TermIcon size={13} className="text-brand-mint" />
          <span className="text-xs text-neutral-400">Terminal panel hidden</span>
        </div>
        <button
          onClick={() => setIsVisible(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-neutral-400 hover:text-white rounded hover:bg-white/5 transition-all cursor-pointer"
          title="Show terminal"
        >
          <Eye size={12} />
          <span>Show</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-dark-border bg-[#141414] flex flex-col flex-shrink-0 relative transition-all">
      <div className="h-9 px-4 border-b border-dark-border flex items-center justify-between bg-[#181818]">
        <div className="flex items-center gap-2">
          <TermIcon size={13} className="text-brand-mint" />
          <span className="text-xs font-medium text-neutral-400">Terminals</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={addTerminal}
            className="p-1 hover:text-white rounded hover:bg-white/5 text-neutral-500 transition-all cursor-pointer"
            title="Add terminal"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:text-white rounded hover:bg-white/5 text-neutral-500 transition-all cursor-pointer"
            title="Hide terminal panel"
          >
            <EyeOff size={12} />
          </button>
        </div>
      </div>

      <div className="p-2 space-y-2 max-h-[28rem] overflow-y-auto">
        {terminalIds.map((id, index) => (
          <TerminalPane
            key={id}
            wsUrl={wsUrl}
            paneIndex={index + 1}
            onClose={() => removeTerminal(id)}
          />
        ))}
      </div>
    </div>
  );
};

const logger = {
  info: (msg: string) => console.log(`[Terminal]: ${msg}`)
};
