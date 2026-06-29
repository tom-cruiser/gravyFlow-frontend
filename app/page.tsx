import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-6">
      <div className="max-w-xl text-center space-y-6">
        <p className="text-xs uppercase tracking-[0.4em] text-zinc-500">GravyFlow</p>
        <h1 className="text-4xl font-semibold sm:text-6xl">Infrastructure canvas for modern deployments.</h1>
        <p className="text-sm text-zinc-400 sm:text-base">
          The dashboard shell is ready. Open the canvas to inspect services, connections, logs, and environment data.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500 px-5 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-sky-400"
        >
          Enter dashboard
        </Link>
      </div>
    </main>
  );
}
