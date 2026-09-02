'use client';

import AppHeader from './components/AppHeader';
import ErrorScreen from './components/ErrorScreen';

/**
 * The net under everything the server-side catches do not cover — a render-time
 * failure in `MapScreen`, the bridge, any client component below `app/`.
 *
 * Deliberately generic. This is a client component, and React replaces
 * `error.message` with an opaque `digest` in production, so there is nothing
 * here to diagnose *from*; the pages that CAN diagnose do it on the server
 * before the error ever reaches this boundary. What this owns is the way back:
 * `reset` re-renders the segment, which is often all a transient failure needs.
 */
export default function AppErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
      <AppHeader phase="idea" />
      <ErrorScreen
        title="This page stopped partway"
        message="Something failed while rendering. Trying again is worth it — the map itself is untouched."
        detail={error.digest ? `digest ${error.digest}` : undefined}
        action={
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        }
      />
    </main>
  );
}
