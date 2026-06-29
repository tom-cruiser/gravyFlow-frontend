import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration: number;
};

type ToastInput = {
  variant?: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const DEFAULT_DURATION_MS = 4500;

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${idCounter}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ variant = 'info', title, message, duration = DEFAULT_DURATION_MS }) => {
    // Dedupe identical, still-visible toasts so a 401 burst or a repeating poll
    // failure can't stack the same message multiple times.
    const existing = get().toasts.find((t) => t.variant === variant && t.message === message);
    if (existing) {
      return existing.id;
    }

    const id = nextId();
    set((state) => ({ toasts: [...state.toasts, { id, variant, title, message, duration }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

// Imperative facade for non-React modules (e.g. the axios interceptor and the
// canvas poll loop) to raise toasts without a hook.
export const toast = {
  push: (input: ToastInput) => useToastStore.getState().push(input),
  success: (message: string, title?: string) =>
    useToastStore.getState().push({ variant: 'success', message, title }),
  error: (message: string, title?: string) =>
    useToastStore.getState().push({ variant: 'error', message, title }),
  info: (message: string, title?: string) =>
    useToastStore.getState().push({ variant: 'info', message, title }),
  warning: (message: string, title?: string) =>
    useToastStore.getState().push({ variant: 'warning', message, title }),
};
