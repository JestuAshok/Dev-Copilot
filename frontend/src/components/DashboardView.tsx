import React, { useState } from 'react';
import { 
  Cpu, HardDrive, Files, MessageSquare, Terminal as TermIcon, 
  RefreshCcw, AlertTriangle, CheckCircle 
} from 'lucide-react';
import { Metrics, ExecutionLog } from '../types';

interface DashboardViewProps {
  metrics: Metrics;
  executionHistory: ExecutionLog[];
  onRefresh: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  executionHistory,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await onRefresh();
    setTimeout(() => setLoading(false), 500);
  };

  const metricCards = [
    { label: 'CPU Load', value: `${metrics.cpu_usage.toFixed(1)}%`, icon: <Cpu size={20} />, color: 'from-brand-sky to-brand-lavender' },
    { label: 'RAM Usage', value: `${metrics.memory_usage.toFixed(1)}%`, icon: <HardDrive size={20} />, color: 'from-brand-lavender to-brand-sky' },
    { label: 'Generated Files', value: `${metrics.generated_files}`, icon: <Files size={20} />, color: 'from-brand-amber to-brand-mint' },
    { label: 'AI Requests', value: `${metrics.ai_requests}`, icon: <MessageSquare size={20} />, color: 'from-brand-mint to-brand-sky' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-[#1A1A1A] space-y-6 relative">
      
      <div className="ambient-glow w-64 h-64 bg-brand-lavender top-10 right-20" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-dark-border pb-4 relative z-10">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-xs text-neutral-500 mt-0.5">System metrics & execution history</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 border border-white/6 text-xs text-neutral-300 hover:text-white hover:bg-white/8 transition-all cursor-pointer"
        >
          <RefreshCcw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        {metricCards.map((m, i) => (
          <div key={i} className="bg-[#212121] p-5 rounded-2xl border border-white/5 flex items-center justify-between card-3d">
            <div className="space-y-1">
              <span className="text-xs text-neutral-500 font-medium">{m.label}</span>
              <div className="text-2xl font-bold text-white">{m.value}</div>
            </div>
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center text-white shadow-depth icon-3d`}>
              {m.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Execution History */}
      <div className="bg-[#212121] border border-white/5 rounded-2xl p-5 space-y-4 relative z-10 card-3d">
        <h2 className="text-sm font-semibold text-neutral-200 flex items-center gap-1.5">
          <TermIcon size={16} className="text-brand-mint" />
          Execution History
        </h2>
        
        {executionHistory.length === 0 ? (
          <div className="text-xs text-neutral-500 py-8 text-center">
            No commands have been executed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-neutral-300 text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 text-neutral-500">
                  <th className="py-3 font-semibold">Command</th>
                  <th className="py-3 font-semibold">Status</th>
                  <th className="py-3 font-semibold text-right">Duration</th>
                  <th className="py-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {executionHistory.map((log) => (
                  <tr key={log.id} className="border-b border-white/3 hover:bg-white/3 transition-colors">
                    <td className="py-3 font-mono text-[11px] text-neutral-200 pr-4 max-w-sm truncate" title={log.command}>
                      {log.command}
                    </td>
                    <td className="py-3">
                      {log.exit_code === 0 ? (
                        <span className="inline-flex items-center gap-1 text-brand-mint">
                          <CheckCircle size={12} />
                          Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-orange-400" title={log.stderr}>
                          <AlertTriangle size={12} />
                          Exit ({log.exit_code})
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono text-neutral-500">{log.execution_time_ms}ms</td>
                    <td className="py-3 text-right text-neutral-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
