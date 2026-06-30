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

// A freshly-created deployment has no container yet, so the backend upgrades
// the socket and immediately closes it (surfaces as code 1006). Retry with
// exponential backoff while the worker finishes building/spawning it.
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 8000;

// Decode a base64url JWT segment without external deps (browser-only component).
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

// True only when we can prove the token is past its exp. Unreadable tokens are
// treated as "not expired" so we let the server be the source of truth.
function isAccessTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return Date.now() >= payload.exp * 1000;
}

const SESSION_EXPIRED_LINE: LogLine = {
  text: '[warn] Session expired — please log in again.',
  stream: 'stderr',
};

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
  const [status, setStatus] = useState<'idle' | 'connecting' | 'reconnecting' | 'open' | 'closed' | 'error'>('idle');
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
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

    let disposed = false;
    attemptRef.current = 0;

    const append = (line: LogLine) => setLines((prev) => [...prev, line]);

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) return;

      // Don't throw blind boot-retries at an auth wall. If the token is gone or
      // demonstrably expired, the WS handshake will be rejected (surfacing as a
      // generic 1006), so short-circuit with a clear message and stop instead.
      // Re-checked on every (re)connect so a token expiring mid-backoff is caught.
      if (isAccessTokenExpired(accessToken)) {
        setStatus('error');
        setLines([SESSION_EXPIRED_LINE]);
        return;
      }

      const attempt = attemptRef.current;
      if (attempt === 0) {
        setLines([{ text: `[connecting] streaming logs for ${deploymentId}...` }]);
        setStatus('connecting');
      } else {
        setStatus('reconnecting');
      }

      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0; // reset budget once a stream succeeds
        setStatus('open');
        append({ text: '[connected] log stream open.' });
      };

      socket.onmessage = (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        const incoming = parseMessage(raw);
        if (incoming.length > 0) {
          setLines((prev) => [...prev, ...incoming]);
        }
      };

      // onerror always fires just before onclose for an abnormal (1006) close;
      // let onclose own the retry/terminal decision to avoid double-handling.
      socket.onerror = () => {};

      socket.onclose = (event) => {
        socketRef.current = null;
        if (disposed) return;

        // Clean server-initiated close — nothing to retry.
        if (event.code === 1000) {
          setStatus('closed');
          append({ text: '[closed] stream ended.' });
          return;
        }

        // Abnormal closure (e.g. 1006 while the container is still booting).
        if (attemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          const nextAttempt = attemptRef.current + 1;
          attemptRef.current = nextAttempt;
          const delay = Math.min(
            RECONNECT_BASE_DELAY_MS * 2 ** (nextAttempt - 1),
            RECONNECT_MAX_DELAY_MS,
          );
          setStatus('reconnecting');
          append({
            text: `[reconnecting] stream dropped (code ${event.code}). attempt ${nextAttempt}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(
              delay / 1000,
            )}s — container may still be starting.`,
          });
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        } else {
          setStatus('error');
          append({
            text: `[error] could not establish a log stream after ${MAX_RECONNECT_ATTEMPTS} attempts (code ${event.code}). The container may have failed to start.`,
            stream: 'stderr',
          });
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket) {
        // Detach handlers so an unmount-triggered close never schedules a retry.
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, 'component unmounted');
      }
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
      : status === 'connecting' || status === 'reconnecting'
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
