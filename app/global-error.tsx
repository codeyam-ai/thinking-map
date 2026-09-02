'use client';

import './globals.css';

/**
 * The last resort: a failure in the root layout itself, where `app/error.tsx`
 * has no layout left to render into.
 *
 * It must supply its own `<html>` and `<body>`, and it cannot lean on anything
 * that assumes the app's chrome mounted — so the shared `ErrorScreen` is
 * deliberately NOT used here. Tokens come from `globals.css`, which is imported
 * directly; nothing else is.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center bg-paper px-4">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface px-8 py-8">
            <h1 className="text-[17px] font-semibold tracking-tight text-ink">
              Thinking Map didn&rsquo;t start
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              The app failed before any page could load. Reloading is the first
              thing to try; the terminal running it has the details.
            </p>
            {error.digest ? (
              <p className="mt-4 font-mono text-[11px] text-muted">
                digest {error.digest}
              </p>
            ) : null}
            <div className="mt-6">
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
              >
                Try again
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
