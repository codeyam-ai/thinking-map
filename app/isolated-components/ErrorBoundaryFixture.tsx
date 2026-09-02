'use client';

// Mount an error boundary in an isolated capture.
//
// A boundary's props come from React, not from a parent, and one of them is a
// FUNCTION — `reset`. An isolation page is a server component, and a server
// component cannot hand a function to a client one ("Functions cannot be passed
// directly to Client Components"), so the isolation route cannot construct
// these props at all. This fixture constructs them on the client instead, which
// is the same argument as `BridgeFixture` beside it: not a mock of the feature,
// but the only way to render it where it has to be seen.
//
// `reset` is deliberately a no-op. In the app it re-renders the failed segment,
// which an isolated page has no equivalent of; a fake that appeared to do
// something would misrepresent the button rather than show it.

import AppErrorBoundary from '@/app/error';
import GlobalError from '@/app/global-error';

const BOUNDARIES = {
  app: AppErrorBoundary,
  global: GlobalError,
} as const;

export default function ErrorBoundaryFixture({
  boundary,
  message,
  digest,
}: {
  boundary: keyof typeof BOUNDARIES;
  message: string;
  /** Omitted for the development case, where React assigns none. */
  digest?: string;
}) {
  const Boundary = BOUNDARIES[boundary];
  const error = Object.assign(new Error(message), digest ? { digest } : {});

  return <Boundary error={error} reset={() => {}} />;
}
