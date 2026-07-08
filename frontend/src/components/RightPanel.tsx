import React, { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Folder, FolderOpen, File, Save, Trash2, Edit3, 
  Download, FilePlus, FolderPlus, X, RefreshCw 
} from 'lucide-react';
import { FileNode } from '../types';

interface RightPanelProps {
  files: FileNode[];
  onRefreshFiles: () => void;
  onOpenFile: (path: string) => Promise<string>;
  onSaveFile: (path: string, content: string) => Promise<void>;
  onDeleteFile: (path: string) => Promise<void>;
  onRenameFile: (path: string, newPath: string) => Promise<void>;
  onDownloadWorkspace: () => void;
}

const getMonacoLanguage = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py': return 'python';
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'sql': return 'sql';
    case 'md': return 'markdown';
    case 'sh': case 'bash': case 'ps1': return 'shell';
    default: return 'plaintext';
  }
};

export const RightPanel: React.FC<RightPanelProps> = ({
  files, onRefreshFiles, onOpenFile, onSaveFile, onDeleteFile, onRenameFile, onDownloadWorkspace
}) => {
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [creationPath, setCreationPath] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  const handleFileClick = async (filePath: string) => {
    setLoadingFile(true);
    try {
      const content = await onOpenFile(filePath);
      setActiveFilePath(filePath);
      setActiveFileContent(content);
      setOriginalContent(content);
    } catch (e) { alert(`Error: ${e}`); }
    finally { setLoadingFile(false); }
  };

  const handleSave = async () => {
    if (!activeFilePath) return;
    try {
      await onSaveFile(activeFilePath, activeFileContent);
      setOriginalContent(activeFileContent);
      alert('Saved.');
    } catch (e) { alert(`Error: ${e}`); }
  };

  const handleDelete = async (filePath: string, e?: React.SyntheticEvent) => {
    e?.stopPropagation();
    if (!confirm(`Delete ${filePath}?`)) return;
    try {
      await onDeleteFile(filePath);
      if (activeFilePath === filePath) { setActiveFilePath(null); setActiveFileContent(''); }
      if (selectedPath === filePath) setSelectedPath(null);
    } catch (e) { alert(`Error: ${e}`); }
  };

  const handleExplorerKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Delete' || !selectedPath || isCreatingFile || isCreatingFolder) return;
    e.preventDefault();
    e.stopPropagation();
    await handleDelete(selectedPath);
  };

  const handleRename = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt(`New path for ${filePath}:`, filePath);
    if (!newName || newName === filePath) return;
    try {
      await onRenameFile(filePath, newName);
      if (activeFilePath === filePath) setActiveFilePath(newName);
    } catch (e) { alert(`Error: ${e}`); }
  };

  const handleCreateItem = async (type: 'file' | 'folder') => {
    if (!newItemName.trim()) return;
    const relPath = creationPath ? `${creationPath}/${newItemName}` : newItemName;
    try {
      if (type === 'file') await onSaveFile(relPath, '');
      else await onSaveFile(`${relPath}/.gitkeep`, '');
      setNewItemName(''); setIsCreatingFile(false); setIsCreatingFolder(false);
      onRefreshFiles();
    } catch (e) { alert(`Error: ${e}`); }
  };

  const toggleDir = (dirPath: string) => {
    setExpandedDirs(prev => ({ ...prev, [dirPath]: !prev[dirPath] }));
  };

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => {
      const isExpanded = expandedDirs[node.path] || false;
      const paddingLeft = depth * 14 + 10;
      
      if (node.isDir) {
        return (
          <div key={node.path}>
            <div 
              style={{ paddingLeft }}
              className={`flex items-center justify-between py-1.5 hover:bg-white/4 rounded-lg cursor-pointer group text-sm transition-colors ${
                selectedPath === node.path ? 'bg-white/6 text-white' : 'text-neutral-300'
              }`}
              onClick={() => { setSelectedPath(node.path); toggleDir(node.path); }}
            >
              <div className="flex items-center gap-2 truncate">
                {isExpanded 
                  ? <FolderOpen size={15} className="text-brand-amber flex-shrink-0" />
                  : <Folder size={15} className="text-brand-sky flex-shrink-0" />
                }
                <span className="truncate text-[13px]">{node.name}</span>
              </div>
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 pr-2">
                <button onClick={(e) => { e.stopPropagation(); setCreationPath(node.path); setIsCreatingFile(true); }} className="p-1 text-neutral-500 hover:text-white rounded hover:bg-white/5 cursor-pointer"><FilePlus size={11} /></button>
                <button onClick={(e) => { e.stopPropagation(); setCreationPath(node.path); setIsCreatingFolder(true); }} className="p-1 text-neutral-500 hover:text-white rounded hover:bg-white/5 cursor-pointer"><FolderPlus size={11} /></button>
                <button onClick={(e) => handleRename(node.path, e)} className="p-1 text-neutral-500 hover:text-white rounded hover:bg-white/5 cursor-pointer"><Edit3 size={11} /></button>
                <button onClick={(e) => handleDelete(node.path, e)} className="p-1 text-neutral-500 hover:text-orange-400 rounded hover:bg-white/5 cursor-pointer"><Trash2 size={11} /></button>
              </div>
            </div>
            {isExpanded && node.children && <div className="mt-0.5">{renderTree(node.children, depth + 1)}</div>}
          </div>
        );
      } else {
        return (
          <div 
            key={node.path}
            style={{ paddingLeft }}
            onClick={() => { setSelectedPath(node.path); handleFileClick(node.path); }}
            className={`flex items-center justify-between py-1.5 hover:bg-white/4 rounded-lg cursor-pointer group text-sm transition-colors ${
              activeFilePath === node.path ? 'bg-white/6 text-white font-medium' : selectedPath === node.path ? 'bg-white/6 text-white' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <File size={15} className="text-neutral-500 flex-shrink-0" />
              <span className="truncate text-[13px]">{node.name}</span>
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 flex-shrink-0 pr-2">
              <button onClick={(e) => handleRename(node.path, e)} className="p-1 hover:text-white rounded hover:bg-white/5 cursor-pointer"><Edit3 size={11} /></button>
              <button onClick={(e) => handleDelete(node.path, e)} className="p-1 hover:text-orange-400 rounded hover:bg-white/5 cursor-pointer"><Trash2 size={11} /></button>
            </div>
          </div>
        );
      }
    });
  };

  return (
    <div className="w-[360px] border-l border-dark-border h-full flex flex-col bg-[#141414] flex-shrink-0">
      
      {/* Header */}
      <div className="h-12 border-b border-dark-border px-4 flex items-center justify-between bg-[#181818]">
        <span className="font-semibold text-sm text-neutral-300">Explorer</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { setCreationPath(''); setIsCreatingFile(true); }} title="New File" className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"><FilePlus size={14} /></button>
          <button onClick={() => { setCreationPath(''); setIsCreatingFolder(true); }} title="New Folder" className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"><FolderPlus size={14} /></button>
          <button onClick={onRefreshFiles} title="Refresh" className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"><RefreshCw size={14} /></button>
          <button onClick={onDownloadWorkspace} title="Download ZIP" className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"><Download size={14} /></button>
        </div>
      </div>

      {/* File Tree */}
      <div
        ref={explorerRef}
        tabIndex={0}
        onMouseDown={() => explorerRef.current?.focus()}
        onKeyDown={handleExplorerKeyDown}
        className="flex-1 overflow-y-auto p-2 space-y-0.5 outline-none"
      >
        {(isCreatingFile || isCreatingFolder) && (
          <div className="p-2 mb-2 bg-white/3 border border-white/8 rounded-xl flex items-center justify-between gap-2">
            <input 
              type="text" 
              placeholder={isCreatingFile ? "filename.py" : "foldername"}
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              className="bg-transparent text-xs border border-white/8 outline-none rounded-lg p-1.5 flex-1 text-white font-mono focus:border-white/15"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <button onClick={() => handleCreateItem(isCreatingFile ? 'file' : 'folder')} className="bg-white text-dark-bg text-[10px] px-2.5 py-1 rounded-lg cursor-pointer font-medium hover:bg-neutral-200">Create</button>
              <button onClick={() => { setIsCreatingFile(false); setIsCreatingFolder(false); setNewItemName(''); }} className="text-neutral-400 hover:text-white cursor-pointer"><X size={14} /></button>
            </div>
          </div>
        )}

        {files.length === 0 ? (
          <div className="text-xs text-neutral-500 text-center py-10">Workspace is empty</div>
        ) : renderTree(files)}
      </div>

      {/* Editor */}
      {activeFilePath && (
        <div className="border-t border-dark-border h-[380px] flex flex-col bg-[#181818]">
          <div className="px-4 py-2 border-b border-dark-border flex items-center justify-between bg-[#1A1A1A]">
            <div className="flex items-center gap-2 truncate">
              <File size={13} className="text-brand-sky" />
              <span className="text-xs font-mono text-neutral-300 truncate">{activeFilePath}</span>
              {activeFileContent !== originalContent && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber" title="Unsaved" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={handleSave} disabled={activeFileContent === originalContent} className="p-1.5 rounded-lg bg-white text-dark-bg hover:bg-neutral-200 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer" title="Save"><Save size={13} /></button>
              <button onClick={() => { setActiveFilePath(null); setActiveFileContent(''); }} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 cursor-pointer" title="Close"><X size={13} /></button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            {loadingFile ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">Loading...</div>
            ) : (
              <Editor
                height="100%"
                theme="vs-dark"
                language={getMonacoLanguage(activeFilePath)}
                value={activeFileContent}
                onChange={(val) => setActiveFileContent(val || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono',
                  scrollbar: { verticalScrollbarSize: 4, horizontalScrollbarSize: 4 },
                  lineNumbers: 'on',
                  automaticLayout: true
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
