'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { Plus, X, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCanvasStore } from '@/store/canvasStore';

function parseDeploymentPort(portMap: string) {
  const [, internalPortRaw] = portMap.split(':');
  const parsed = Number.parseInt(internalPortRaw ?? '80', 10);
  return Number.isFinite(parsed) ? parsed : 80;
}

function centerCanvasPoint() {
  if (typeof window === 'undefined') {
    return { x: 0, y: 0 };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function worldPointFromScreen(screenX: number, screenY: number, viewportX: number, viewportY: number, scale: number) {
  return {
    x: (screenX - viewportX) / scale,
    y: (screenY - viewportY) / scale,
  };
}

export function NewServiceButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const user = useAuthStore((state) => state.user);
  const canvasTransform = useCanvasStore((state) => state.canvasTransform);
  const addNode = useCanvasStore((state) => state.addNode);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const buttonLabel = useMemo(() => (isSubmitting ? 'Provisioning…' : 'New Service'), [isSubmitting]);

  const openModal = () => {
    setErrorMessage(null);
    setIsOpen(true);
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setServiceName('');
    setRepositoryUrl('');
    setErrorMessage(null);
  };

  // Keyboard accessibility: Escape key dismisses modal safely
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const name = serviceName.trim();
    const repo = repositoryUrl.trim();
    if (!name || !repo) {
      setErrorMessage('Service name and repository URL are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post('/apps', { name, repo });

      if (response.status !== 201 && response.status !== 202) {
        throw new Error('Provisioning was not accepted by the control plane.');
      }

      const { x: screenX, y: screenY } = centerCanvasPoint();
      const center = worldPointFromScreen(screenX, screenY, canvasTransform.viewportX, canvasTransform.viewportY, canvasTransform.scale);
      const internalPort = parseDeploymentPort(response.data?.app?.portMap ?? '8080:8080');
      const deploymentId = response.data?.deploymentId ?? crypto.randomUUID();

      addNode({
        id: deploymentId,
        name,
        type: 'web',
        status: 'BUILDING',
        positionX: center.x,
        positionY: center.y,
        internalPort,
        repo,
      });
      setSelectedNodeId(deploymentId);
      setIsOpen(false);
      setServiceName('');
      setRepositoryUrl('');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to create service.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Primary Floating Action Trigger */}
      <button
        type="button"
        onClick={openModal}
        className="fixed bottom-6 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all hover:bg-sky-400 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4 stroke-[3]" />
        {buttonLabel}
      </button>

      {isOpen && (
        /* Modal Backdrop Overlay with backdrop click handler for intuitive dismiss */
        <div 
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div 
            ref={modalRef}
            className="w-full max-w-lg rounded-[2rem] border border-zinc-800 bg-zinc-950/95 p-8 text-zinc-100 shadow-[0_32px_120px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            {/* Header Block Container */}
            <div className="mb-6 flex items-start justify-between gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-sky-400">Dynamic Provisioning</p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-zinc-100">Create a new service</h2>
                <p className="mt-1 text-sm text-zinc-400">Submit metadata parameters to coordinate canvas node deployment profiles.</p>
              </div>
              
              {/* Clean Icon X Button instead of redundant text */}
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="rounded-full border border-zinc-800 bg-zinc-900/50 p-2 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-40"
                aria-label="Close configuration modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Error Message Layout Isolation */}
            {errorMessage && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in duration-150">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Input Group: Service Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="serviceName" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  Service Name
                </label>
                <input
                  id="serviceName"
                  autoFocus
                  value={serviceName}
                  onChange={(event) => setServiceName(event.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  placeholder="payments-api"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              {/* Input Group: Git Repository */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="repositoryUrl" className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                  Git Repository URL
                </label>
                <input
                  id="repositoryUrl"
                  type="url"
                  value={repositoryUrl}
                  // FIXED: Changed event.target.trim() to event.target.value.trim()
                  onChange={(event) => setRepositoryUrl(event.target.value.trim())}
                  placeholder="https://github.com/org/repo"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  required
                />
              </div>

              {/* Footer Controls Component */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-5 py-2.5 text-sm font-semibold text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-sky-500/10 transition-all hover:bg-sky-400 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
                >
                  {isSubmitting ? 'Provisioning…' : `Deploy as ${user?.displayName || 'User'}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}