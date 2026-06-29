import type { ButtonHTMLAttributes } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-white ${className}`}
    />
  );
}
