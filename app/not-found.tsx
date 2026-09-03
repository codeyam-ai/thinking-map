import AppHeader from './components/AppHeader';
import ErrorScreen from './components/ErrorScreen';

/**
 * Where `notFound()` from the map route lands, and where a stale bookmark to a
 * deleted map lands too.
 *
 * Per the design system, this describes the next action rather than reporting
 * the absence — the useful thing about arriving here is that starting a map is
 * one click away.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col px-4 py-4 sm:px-6 lg:px-10 lg:py-8">
      <AppHeader />
      <ErrorScreen
        title="No map with that link"
        message="Either it was never here or it has since been deleted. Whatever you were thinking about is still worth mapping."
        action={
          // A plain anchor with `suppressHydrationWarning`, matching `Wordmark`
          // and `SavedMapRow`: the preview proxy serves the app under a path
          // prefix and rewrites `href` in the server HTML, so a `next/link`
          // here hydrates against a different href and warns on every capture.
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- the preview proxy rewrites `href` in the server HTML, so `next/link` would hydrate against a different href on every scenario capture
          <a
            href="/"
            suppressHydrationWarning
            className="inline-block rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
          >
            Start a new map
          </a>
        }
      />
    </main>
  );
}
