import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Plus, LayoutDashboard, Settings, 
  Trash2, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { Conversation, ViewMode } from '../types';

interface LeftSidebarProps {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  conversations: Conversation[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  collapsed,
  setCollapsed,
  conversations,
  activeChatId,
  setActiveChatId,
  viewMode,
  setViewMode,
  onNewChat,
  onDeleteChat
}) => {
  return (
    <motion.div
      animate={{ width: collapsed ? 60 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="h-full bg-[#141414] border-r border-dark-border flex flex-col relative select-none flex-shrink-0"
    >
      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full bg-[#303030] border border-dark-border hover:bg-[#404040] text-neutral-300 flex items-center justify-center transition-all shadow-depth z-50 cursor-pointer"
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      {/* Brand */}
      <div className="p-4 flex items-center gap-3 border-b border-dark-border overflow-hidden">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-sky via-brand-lavender to-brand-mint flex items-center justify-center shadow-depth flex-shrink-0 icon-3d">
          <Zap size={16} className="text-white" />
        </div>
        {!collapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-bold text-base text-white truncate tracking-tight"
          >
            DevCopilot
          </motion.span>
        )}
      </div>

      {/* New Session */}
      <div className="p-3 flex flex-col gap-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/6 text-neutral-200 transition-all justify-center cursor-pointer group"
        >
          <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
          {!collapsed && <span className="font-medium text-sm">New Session</span>}
        </button>
      </div>

      {/* Nav */}
      <div className="px-3 py-2 flex flex-col gap-1 border-b border-dark-border">
        <button
          onClick={() => setViewMode('chat')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer ${
            viewMode === 'chat' 
              ? 'bg-white/8 text-white font-medium' 
              : 'text-neutral-400 hover:text-white hover:bg-white/4'
          }`}
        >
          <MessageSquare size={18} />
          {!collapsed && <span>Chat</span>}
        </button>

        <button
          onClick={() => setViewMode('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer ${
            viewMode === 'dashboard' 
              ? 'bg-white/8 text-white font-medium' 
              : 'text-neutral-400 hover:text-white hover:bg-white/4'
          }`}
        >
          <LayoutDashboard size={18} />
          {!collapsed && <span>Dashboard</span>}
        </button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {!collapsed && <div className="px-2 text-[10px] font-semibold text-neutral-500 uppercase tracking-widest mb-2">Recent</div>}
        
        <AnimatePresence>
          {conversations.map((chat) => (
            <motion.div
              key={chat.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className={`group flex items-center justify-between p-2 rounded-xl text-sm cursor-pointer transition-all ${
                activeChatId === chat.id && viewMode === 'chat'
                  ? 'bg-white/8 text-white font-medium'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/4'
              }`}
              onClick={() => {
                setViewMode('chat');
                setActiveChatId(chat.id);
              }}
            >
              <div className="flex items-center gap-2.5 truncate w-full">
                <MessageSquare size={15} className="opacity-60 flex-shrink-0" />
                {!collapsed && (
                  <span className="truncate pr-2 text-[13px]">{chat.title || "Untitled"}</span>
                )}
              </div>
              
              {!collapsed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteChat(chat.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-orange-400 p-1 transition-all rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-dark-border mt-auto">
        <button
          onClick={() => setViewMode('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-all cursor-pointer ${
            viewMode === 'settings' 
              ? 'bg-white/8 text-white font-medium' 
              : 'text-neutral-400 hover:text-white hover:bg-white/4'
          }`}
        >
          <Settings size={18} />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </motion.div>
  );
};
