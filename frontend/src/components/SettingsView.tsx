import React, { useState, useEffect } from 'react';
import { Settings, Save, Lock, Sliders, Shield } from 'lucide-react';
import { Config } from '../types';

interface SettingsViewProps {
  config: Config;
  onSaveConfig: (updated: Partial<Config>) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  onSaveConfig
}) => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [theme, setTheme] = useState('dark');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    if (config) {
      setApiKey(config.gemini_api_key || '');
      setModel(config.gemini_model || 'gemini-2.5-flash');
      setTemperature(config.temperature ?? 0.7);
      setMaxTokens(config.max_tokens ?? 4096);
      setTheme(config.theme || 'dark');
    }
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('');
    try {
      await onSaveConfig({
        gemini_api_key: apiKey,
        gemini_model: model,
        temperature,
        max_tokens: maxTokens,
        theme
      });
      setSaveStatus('Settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      setSaveStatus(`Error saving: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#1A1A1A] max-w-3xl space-y-6">
      
      {/* Header */}
      <div className="border-b border-dark-border pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Settings size={22} className="text-neutral-400" />
          Settings
        </h1>
        <p className="text-xs text-neutral-500 mt-0.5">Configure API keys, model parameters, and workspace settings.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        
        {/* API Key */}
        <div className="bg-[#212121] border border-white/5 rounded-2xl p-5 space-y-4 card-3d">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-amber to-brand-mint flex items-center justify-center">
              <Lock size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-white">API Credentials</h2>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-neutral-400 font-medium block">Gemini API Key</label>
            <input 
              type="password" 
              placeholder="AIzaSy..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[#1A1A1A] text-xs text-white border border-white/8 rounded-xl p-3 outline-none focus:border-white/15 transition-colors font-mono"
            />
            <p className="text-[10px] text-neutral-500">Stored locally in your SQLite database. Never sent externally.</p>
          </div>
        </div>

        {/* Model Settings */}
        <div className="bg-[#212121] border border-white/5 rounded-2xl p-5 space-y-4 card-3d">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-sky to-brand-lavender flex items-center justify-center">
              <Sliders size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-white">Model Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">Model</label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-[#1A1A1A] text-xs text-white border border-white/8 rounded-xl p-3 outline-none focus:border-white/15 cursor-pointer"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs text-neutral-400 font-medium block">Theme</label>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                className="w-full bg-[#1A1A1A] text-xs text-white border border-white/8 rounded-xl p-3 outline-none focus:border-white/15 cursor-pointer"
              >
                <option value="dark">Dark (Default)</option>
                <option value="glass">Translucent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs text-neutral-400 font-medium block">Temperature — {temperature}</label>
              <input 
                type="range" min="0.0" max="1.0" step="0.1" 
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/8 rounded-lg appearance-none cursor-pointer accent-brand-sky"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-neutral-400 font-medium block">Max Tokens — {maxTokens}</label>
              <input 
                type="range" min="1024" max="8192" step="1024" 
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full h-1.5 bg-white/8 rounded-lg appearance-none cursor-pointer accent-brand-lavender"
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-[#212121] border border-white/5 rounded-2xl p-5 space-y-4 card-3d">
          <div className="flex items-center gap-2 border-b border-white/5 pb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-amber to-brand-mint flex items-center justify-center">
              <Shield size={14} className="text-white" />
            </div>
            <h2 className="text-sm font-semibold text-white">Security & Isolation</h2>
          </div>
          <div className="space-y-2 text-xs text-neutral-400 leading-relaxed">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span>Workspace Path</span>
              <span className="font-mono text-[11px] text-neutral-200">{config.workspace_path}</span>
            </div>
            <p className="text-neutral-500">
              All file operations and code execution are sandboxed within this directory.
            </p>
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-white text-dark-bg hover:bg-neutral-200 text-xs font-semibold flex items-center gap-1.5 shadow-depth transition-all disabled:opacity-50 cursor-pointer"
          >
            <Save size={14} />
            {saving ? "Saving..." : "Save Settings"}
          </button>
          
          {saveStatus && (
            <span className={`text-xs ${saveStatus.includes('Error') ? 'text-orange-400' : 'text-brand-mint font-medium'}`}>
              {saveStatus}
            </span>
          )}
        </div>

      </form>
    </div>
  );
};
