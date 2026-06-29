'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';

type LogViewerProps = {
  deploymentId: string | null;
};

type LogLine = {
  text: string;
  stream?: 'stdout' | 'stderr';
};

const idleLines: LogLine[] = [
  { text: '[ready] waiting for logs...' },
  { text: '[info] connect a node to stream deployment output.' },
];

function parseMessage(raw: string): LogLine[] {
  try {
    const parsed = JSON.parse(raw);

    // Backend sends { stream: 'stdout'|'stderr', line: '...' }
    if (parsed && typeof parsed.line === 'string') {
      return [{ text: parsed.line, stream: parsed.stream }];
    }

    // Backend may send { error: '...' }
    if (parsed && typeof parsed.error === 'string') {
      return [{ text: `[error] ${parsed.error}`, stream: 'stderr' }];
    }

    // Backend may send { message: '...' } for status updates
    if (parsed && typeof parsed.message === 'string') {
      return [{ text: `[info] ${parsed.message}` }];
    }

    return [{ text: raw }];
  } catch {
    // Plain text fallback
    return raw
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter(Boolean)
      .map((text) => ({ text }));
  }
}

export function LogViewer({ deploymentId }: LogViewerProps) {
  const [lines, setLines] = useState<LogLine[]>(idleLines);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'closed' | 'error'>('idle');
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  const socketUrl = useMemo(() => {
    if (!deploymentId || !accessToken) return null;

    // Derive the WS endpoint from the same base the REST client uses, instead of
    // hardcoding the host. Resolve against the current origin so a relative base
    // (e.g. "/api") works behind a reverse proxy too.
    const restBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api';
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    const url = new URL(`${restBase.replace(/\/+$/, '')}/apps/${deploymentId}/logs`, origin);

    // ws ⇄ http, wss ⇄ https. Force wss whenever the page itself is served over
    // HTTPS, otherwise the browser blocks the insecure socket as mixed content.
    const secure =
      url.protocol === 'https:' ||
      (typeof window !== 'undefined' && window.location.protocol === 'https:');
    url.protocol = secure ? 'wss:' : 'ws:';

    // Pass auth token as query param since WS doesn't support Authorization headers.
    url.searchParams.set('token', accessToken);

    return url.toString();
  }, [deploymentId, accessToken]);

  useEffect(() => {
    if (!socketUrl) {
      setLines(idleLines);
      setStatus('idle');
      return;
    }

    setLines([{ text: `[connecting] streaming logs for ${deploymentId}...` }]);
    setStatus('connecting');

    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      setStatus('open');
      setLines((prev) => [...prev, { text: '[connected] log stream open.' }]);
    };

    socket.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : '';
      const incoming = parseMessage(raw);
      if (incoming.length > 0) {
        setLines((prev) => [...prev, ...incoming]);
      }
    };

    socket.onerror = () => {
      setStatus('error');
      setLines((prev) => [
        ...prev,
        { text: '[error] could not connect to log stream. The container may still be starting.', stream: 'stderr' },
      ]);
    };

    socket.onclose = (event) => {
      setStatus('closed');
      if (event.code !== 1000) {
        setLines((prev) => [...prev, { text: `[closed] stream ended (code ${event.code}).` }]);
      } else {
        setLines((prev) => [...prev, { text: '[closed] stream ended.' }]);
      }
    };

    return () => {
      socket.close(1000, 'component unmounted');
    };
  }, [socketUrl, deploymentId]);

  // Auto-scroll to bottom on new lines
  useEffect(() => {
    const viewport = logViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [lines]);

  const statusDot =
    status === 'open'
      ? 'bg-emerald-400'
      : status === 'connecting'
        ? 'bg-yellow-400 animate-pulse'
        : status === 'error'
          ? 'bg-rose-500'
          : 'bg-zinc-600';

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-800 bg-black/95 shadow-glow">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-zinc-100">Deployment Logs</p>
          <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">
            {deploymentId ? `deployment · ${deploymentId.slice(0, 8)}` : 'No service selected'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot}`} />
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-zinc-300">
            WS
          </span>
        </div>
      </div>
      <div
        ref={logViewportRef}
        className="min-h-0 flex-1 overflow-auto px-4 py-4 font-mono text-xs leading-6"
      >
        {lines.map((line, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap break-words ${
              line.stream === 'stderr' ? 'text-rose-400' : 'text-emerald-300'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
