"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, AlertCircle } from 'lucide-react'; // Added AlertCircle for better error semantics

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      const resp = await api.post('/auth/login', { email, password });
      const data = resp.data;
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
      router.push('/dashboard');
    } catch (err: any) {
      const backendError = err?.response?.data?.error;
      const statusCode = err?.response?.status;

      let message = 'Login failed. Please try again.';
      if (statusCode === 401 || backendError === 'invalid_credentials') {
        message = 'Invalid email or password.';
      } else if (backendError) {
        message = String(backendError).replace(/_/g, ' ');
      } else if (err?.message) {
        message = String(err.message);
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100 flex items-center justify-center">
      {/* Optimized Layout: Balanced max-width and split ratios */}
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-900/40 shadow-2xl backdrop-blur-md grid md:grid-cols-12">
        
        {/* Left Informational Side: Takes 7 cols on desktop, hidden on small screens */}
        <section className="hidden md:flex md:col-span-7 flex-col justify-between border-r border-zinc-800 p-12">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-400">GravyFlow Auth</p>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight tracking-tight bg-gradient-to-br from-zinc-50 to-zinc-400 bg-clip-text text-transparent">
              Sign in to the deployment canvas.
            </h1>
            <p className="max-w-md text-sm lg:text-base text-zinc-400 leading-relaxed">
              Use your account to manage high-performance projects, custom domains, and programmatic edge deployments.
            </p>
          </div>
          
          <div className="mt-12 grid gap-3 text-xs text-zinc-400 grid-cols-3">
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 font-medium tracking-wide">JWT Sessions</div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 font-medium tracking-wide">Refresh Tokens</div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3.5 font-medium tracking-wide">User Scopes</div>
          </div>
        </section>

        {/* Right Form Side: Takes 5 cols on desktop, full width on mobile */}
        <section className="col-span-12 md:col-span-5 flex items-center justify-center p-8 lg:p-12 bg-zinc-950/30">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-zinc-100">Sign in</h3>
              <p className="text-xs text-zinc-400 mt-1">Welcome back! Enter your credentials below.</p>
            </div>

            {/* Structured Error Block to avoid unstyled raw text shifts */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300 animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-xs font-medium text-zinc-400">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 transition-all focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  placeholder="name@company.com"
                  required
                />
              </div>
              
              {/* Password Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-medium text-zinc-400">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 pl-3.5 pr-10 py-2.5 text-sm text-zinc-100 transition-all focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Action Rows: High Contrast Primary Button */}
              <div className="flex flex-col gap-4 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-sky-400 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-sky-500/10"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                
                <p className="text-center text-xs text-zinc-500">
                  Don't have an account?{' '}
                  <Link href="/register" className="font-medium text-zinc-300 hover:text-sky-400 transition-colors underline underline-offset-4">
                    Create one here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}