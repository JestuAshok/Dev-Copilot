import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, Paperclip, Terminal as TermIcon, BrainCircuit, 
  Mic, MicOff, RefreshCcw, Sparkles, Copy, Check, FileCode
} from 'lucide-react';
import { Message } from '../types';

interface AgentStep {
  thought?: string;
  plan?: string;
  toolCall?: { tool: string; args: any };
  toolResult?: { tool: string; result: any };
}

interface CenterPanelProps {
  messages: Message[];
  loading: boolean;
  statusText: string;
  agentSteps: AgentStep[];
  onSendMessage: (msg: string, mode?: 'build' | 'plan' | 'review') => void;
  onFileUpload: (file: File) => void;
}

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

// 3D Animated Cube Component
const AnimatedCube: React.FC = () => (
  <div className="cube-scene mb-6 animate-float">
    <div className="cube">
      <div className="cube-face cube-face--front" />
      <div className="cube-face cube-face--back" />
      <div className="cube-face cube-face--right" />
      <div className="cube-face cube-face--left" />
      <div className="cube-face cube-face--top" />
      <div className="cube-face cube-face--bottom" />
    </div>
  </div>
);

// Code block renderer
const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative border border-white/8 rounded-xl overflow-hidden my-4 bg-[#141414] font-mono text-sm shadow-depth">
      <div className="flex items-center justify-between px-4 py-2 bg-white/3 border-b border-white/5 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5 font-medium">
          <FileCode size={14} className="text-brand-sky" />
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check size={12} className="text-brand-mint" />
              <span className="text-brand-mint">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        <pre className="m-0 leading-relaxed text-neutral-200"><code>{value}</code></pre>
      </div>
    </div>
  );
};

// ===== Speech Recognition Hook =====
const useSpeechRecognition = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const shouldKeepListeningRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcriptChunk = result[0]?.transcript || '';
        if (result.isFinal) {
          finalTranscript += transcriptChunk;
        } else {
          interimTranscript += transcriptChunk;
        }
      }

      if (finalTranscript.trim()) {
        setTranscript(finalTranscript.trim());
        setVoiceError(null);
        shouldKeepListeningRef.current = false;
        setIsListening(false);
        isListeningRef.current = false;
        try { recognition.stop(); } catch (e) {}
      } else if (interimTranscript.trim()) {
        setTranscript(interimTranscript.trim());
        setVoiceError(null);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      const message = event.error === 'not-allowed'
        ? 'Microphone access was denied. Please allow microphone access and try again.'
        : 'Voice input encountered an error. Please try again.';
      setVoiceError(message);
      setIsListening(false);
      isListeningRef.current = false;
    };

    recognition.onend = () => {
      if (shouldKeepListeningRef.current && isListeningRef.current) {
        try {
          recognitionRef.current?.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
          setIsListening(false);
          isListeningRef.current = false;
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const startListening = async () => {
    if (!recognitionRef.current) {
      setVoiceError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    if (isListeningRef.current) return;

    setTranscript('');
    setVoiceError(null);
    shouldKeepListeningRef.current = true;
    setIsListening(true);
    isListeningRef.current = true;

    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      recognitionRef.current.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setVoiceError('Microphone access was denied or is unavailable. Please allow microphone access and try again.');
      setIsListening(false);
      isListeningRef.current = false;
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
    shouldKeepListeningRef.current = false;
    setIsListening(false);
    isListeningRef.current = false;
  };

  const isSupported = typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  return { isListening, transcript, voiceError, startListening, stopListening, isSupported };
};

export const CenterPanel: React.FC<CenterPanelProps> = ({
  messages,
  loading,
  statusText,
  agentSteps,
  onSendMessage,
  onFileUpload
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSteps, setShowSteps] = useState(true);
  const [mode, setMode] = useState<'build' | 'plan' | 'review'>('build');

  const modeCopy: Record<'build' | 'plan' | 'review', { label: string; subtitle: string; accent: string }> = {
    build: { label: 'Build', subtitle: 'Implement and validate', accent: 'text-brand-mint' },
    plan: { label: 'Plan', subtitle: 'Spec and architecture first', accent: 'text-brand-amber' },
    review: { label: 'Review', subtitle: 'Inspect and improve', accent: 'text-brand-lavender' }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastVoiceSubmissionRef = useRef('');

  const { isListening, transcript, voiceError, startListening, stopListening, isSupported } = useSpeechRecognition();

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, agentSteps]);

  // Sync voice transcript into input and auto-send the final message
  useEffect(() => {
    if (!transcript || isListening) return;

    const nextTranscript = transcript.trim();
    if (!nextTranscript || nextTranscript === lastVoiceSubmissionRef.current) return;

    lastVoiceSubmissionRef.current = nextTranscript;
    setInputValue(nextTranscript);

    const timer = window.setTimeout(() => {
      if (!loading) {
        onSendMessage(nextTranscript, mode);
        setInputValue('');
        lastVoiceSubmissionRef.current = '';
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [transcript, isListening, loading, onSendMessage]);

  const handleSend = () => {
    if (!inputValue.trim() || loading) return;
    if (isListening) stopListening();
    onSendMessage(inputValue, mode);
    setInputValue('');
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileUpload(files[0]);
    }
  };

  const toggleVoice = async () => {
    if (isListening) {
      stopListening();
    } else {
      await startListening();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1A1A1A] relative overflow-hidden">
      
      {/* Ambient soft glows */}
      <div className="ambient-glow w-96 h-96 bg-brand-lavender top-0 left-1/4" />
      <div className="ambient-glow w-80 h-80 bg-brand-mint bottom-20 right-1/4" />

      {/* Status Bar — only when loading */}
      {loading && (
        <div className="h-10 border-b border-dark-border px-6 flex items-center justify-center bg-[#1A1A1A]/80 backdrop-blur-md z-10 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <RefreshCcw size={12} className="animate-spin text-brand-sky" />
            <span>{statusText || "Copilot is thinking..."}</span>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 relative z-10">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
            <AnimatedCube />
            <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">
              Hey, {getGreeting().toLowerCase()}!
            </h1>
            <p className="text-base text-neutral-500 mb-6">
              Let's get started with your conversation
            </p>
          </div>
        ) : (
          <div className="space-y-5 max-w-3xl mx-auto py-4">
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-dark-card border border-dark-border flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles size={14} className="text-brand-lavender" />
                  </div>
                )}

                <div 
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed msg-bubble ${
                    msg.role === 'user' 
                      ? 'bg-[#303030] text-white rounded-tr-md' 
                      : 'bg-[#242424] text-neutral-200 border border-white/5 rounded-tl-md'
                  }`}
                >
                  <ReactMarkdown
                    components={{
                      code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');
                        return match ? (
                          <CodeBlock language={match[1]} value={codeContent} />
                        ) : (
                          <code className="bg-white/8 px-1.5 py-0.5 rounded text-brand-sky font-mono text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-brand-sky/20 border border-brand-sky/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-xs font-bold text-brand-sky">U</span>
                  </div>
                )}
              </div>
            ))}

            {/* Agent Thinking */}
            {loading && agentSteps.length > 0 && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-dark-card border border-dark-border flex items-center justify-center flex-shrink-0 mt-1">
                  <BrainCircuit size={14} className="text-brand-lavender animate-pulse" />
                </div>
                <div className="max-w-[80%] bg-[#242424] border border-white/5 rounded-2xl rounded-tl-md p-4 space-y-3 msg-bubble">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-semibold text-brand-lavender flex items-center gap-1.5">
                      <BrainCircuit size={13} />
                      Thinking...
                    </span>
                    <button 
                      onClick={() => setShowSteps(!showSteps)} 
                      className="text-[10px] text-neutral-500 hover:text-white px-2 py-0.5 rounded bg-white/5 transition-all cursor-pointer"
                    >
                      {showSteps ? "Hide" : "Show"}
                    </button>
                  </div>
                  
                  {showSteps && (
                    <div className="space-y-2 max-h-52 overflow-y-auto text-xs font-mono">
                      {agentSteps.map((step, idx) => (
                        <div key={idx} className="border-l-2 border-white/10 pl-3 space-y-1">
                          {step.thought && (
                            <div>
                              <span className="text-brand-sky font-medium">[THOUGHT]</span>
                              <p className="text-neutral-400 mt-0.5 leading-relaxed">{step.thought}</p>
                            </div>
                          )}
                          {step.plan && (
                            <div className="mt-1">
                              <span className="text-brand-amber font-medium">[PLAN]</span>
                              <pre className="text-neutral-400 font-sans mt-0.5 whitespace-pre-wrap">{step.plan}</pre>
                            </div>
                          )}
                          {step.toolCall && (
                            <div className="mt-1 bg-white/3 p-2 rounded-lg border border-white/5">
                              <span className="text-brand-mint font-medium flex items-center gap-1">
                                <TermIcon size={11} />
                                {step.toolCall.tool}
                              </span>
                              {step.toolCall.args && (
                                <pre className="text-neutral-500 text-[10px] overflow-x-auto mt-1 max-h-16">
                                  {JSON.stringify(step.toolCall.args, null, 2)}
                                </pre>
                              )}
                            </div>
                          )}
                          {step.toolResult && (
                            <div className="mt-1 bg-brand-mint/5 p-2 rounded-lg border border-brand-mint/10">
                              <span className="text-brand-mint font-medium text-[11px]">✓ {step.toolResult.tool}</span>
                              <pre className="text-neutral-500 text-[10px] overflow-x-auto mt-1 max-h-24">
                                {typeof step.toolResult.result === 'string' 
                                  ? step.toolResult.result 
                                  : JSON.stringify(step.toolResult.result, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Typing dots */}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-dark-card border border-dark-border flex items-center justify-center flex-shrink-0">
                  <Sparkles size={14} className="text-brand-lavender" />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-[#242424] border border-white/5 rounded-tl-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ===== INPUT BAR ===== */}
      <div className="px-6 pb-6 pt-2 flex-shrink-0 relative z-10">
        <div className="max-w-2xl mx-auto">
          {/* Voice listening indicator */}
          {isListening && (
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-brand-lavender animate-pulse" />
              <span className="text-xs text-brand-lavender font-medium animate-pulse">Listening... speak now</span>
              <span className="w-2 h-2 rounded-full bg-brand-lavender animate-pulse" />
            </div>
          )}
          {voiceError && (
            <p className="text-center text-xs text-amber-400 mb-3">{voiceError}</p>
          )}

          <div className="mb-3 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#232323]/90 px-3 py-1.5 shadow-[0_0_20px_rgba(255,255,255,0.03)]">
              <span className={`text-[11px] font-semibold ${modeCopy[mode].accent}`}>{modeCopy[mode].label}</span>
              <span className="text-[10px] text-neutral-500">•</span>
              <span className="text-[10px] text-neutral-400">{modeCopy[mode].subtitle}</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'build' | 'plan' | 'review')}
                className="ml-1 rounded-full border border-white/10 bg-[#1d1d1d] px-2 py-0.5 text-[10px] text-neutral-200 outline-none"
                aria-label="Select Kiro mode"
              >
                <option value="build">Build</option>
                <option value="plan">Plan</option>
                <option value="review">Review</option>
              </select>
            </div>
          </div>

          <div className={`bg-[#2A2A2A] rounded-full border flex items-center gap-2 px-4 py-1 input-glow transition-all ${
            isListening ? 'border-brand-lavender/40 shadow-[0_0_20px_rgba(162,155,254,0.15)]' : 'border-white/8'
          }`}>
            
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={isListening ? "Listening..." : "Chat with Copilot"}
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none text-sm text-white placeholder-neutral-500 py-2.5 resize-none max-h-24 focus:ring-0"
            />

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".py,.java,.js,.ts,.html,.css,.json,.md,.zip"
            />

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={triggerUpload}
                disabled={loading}
                title="Upload file"
                className="p-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Paperclip size={18} />
              </button>
              
              {/* Voice Button — Working! */}
              <button
                onClick={() => void toggleVoice()}
                disabled={!isSupported}
                title={isListening ? "Stop listening" : isSupported ? "Start voice input" : "Voice not supported in this browser"}
                className={`p-2 rounded-full transition-all cursor-pointer ${
                  isListening 
                    ? 'bg-brand-lavender/20 text-brand-lavender animate-pulse' 
                    : isSupported
                      ? 'text-neutral-400 hover:text-white hover:bg-white/5'
                      : 'text-neutral-600 cursor-not-allowed opacity-40'
                }`}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              {inputValue.trim() && (
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="p-2 rounded-full bg-white text-dark-bg hover:bg-neutral-200 transition-all disabled:opacity-50 cursor-pointer ml-1"
                >
                  <Send size={16} />
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-neutral-600 text-center mt-2">
            AI-generated content may be incorrect. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};
