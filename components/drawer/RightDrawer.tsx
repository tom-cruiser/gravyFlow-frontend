'use client';

import { useMemo, useState } from 'react';
import { Activity, Database, ChevronLeft, Shield } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { EnvManager } from './EnvManager';
import { LogViewer } from './LogViewer';
import { DomainManager } from './DomainManager';

type DrawerTab = 'logs' | 'env' | 'networking';

type RightDrawerProps = {
  open: boolean;
};

const tabs: Array<{ id: DrawerTab; label: string; icon: typeof Activity }> = [
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'env', label: 'Env', icon: Database },
  { id: 'networking', label: 'Domains', icon: Shield },
];

export function RightDrawer({ open }: RightDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>('logs');
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const selectedNode = useCanvasStore((state) =>
    state.nodes.find((node) => node.id === state.selectedNodeId) ?? null,
  );
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const heading = useMemo(() => selectedNode?.name ?? 'Select a service', [selectedNode]);

  return (
    <aside
      className={`fixed right-0 top-0 z-30 flex h-screen w-[420px] max-w-[90vw] transform border-l border-zinc-800 bg-zinc-950/95 text-zinc-100 shadow-[-40px_0_80px_rgba(0,0,0,0.45)] backdrop-blur transition-transform duration-300 ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-zinc-500">Context Panel</p>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">{heading}</h2>
            <p className="mt-1 text-xs text-zinc-500">{selectedNode ? `${selectedNode.type.toUpperCase()} • ${selectedNode.status}` : 'No node selected'}</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedNodeId(null)}
            className="rounded-full border border-zinc-800 bg-zinc-900 p-2 text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100"
            aria-label="Close drawer"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-zinc-800 px-5 py-3">
          <div
            className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-1"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-5 py-4">
          <div className="h-full space-y-4">
            {activeTab === 'logs' ? <LogViewer deploymentId={selectedNodeId} /> : null}
            {activeTab === 'env' ? <EnvManager deploymentId={selectedNodeId} /> : null}
            {activeTab === 'networking' ? <DomainManager deploymentId={selectedNodeId} /> : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
