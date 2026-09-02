'use client';

// Supply a failed API response to an isolated capture.
//
// The states this feature exists to handle — a 500 whose body is empty, a proxy
// 502 carrying HTML, a route answering with a diagnosis — are exactly the ones
// a healthy dev server will not produce on request. So a capture cannot reach
// them by driving the app harder; it reaches them by being given the response,
// which is what this does. Same argument as `BridgeFixture` beside it: not a
// mock of the feature, but the only way to see the feature where it must be
// seen.
//
// Only `/api/` requests are intercepted. Framework traffic — RSC navigation,
// HMR — goes to the real `fetch` untouched, so standing a failure up does not
// also break the page it is being shown on.
//
// Lives beside the isolation routes rather than in the component, because the
// production path should not carry a capture-only seam.

import { useRef } from 'react';

export type StubbedFailure = {
  status: number;
  /** The body verbatim. Empty string for the reported case: a 500 with none. */
  body: string;
  /** Defaults to JSON, since that is what a route answers with. */
  contentType?: string;
};

export default function FetchFailureFixture({
  failure,
  children,
}: {
  failure: StubbedFailure;
  children?: React.ReactNode;
}) {
  // Installed during render rather than in an effect: the capture drives a
  // submit as soon as the page is interactive, and an effect that has not run
  // yet would let that first request through to the real route.
  const installed = useRef(false);
  if (!installed.current && typeof window !== 'undefined') {
    installed.current = true;
    const real = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.pathname
            : input.url;
      if (!url.includes('/api/')) return real(input, init);
      return new Response(failure.body, {
        status: failure.status,
        headers: { 'content-type': failure.contentType ?? 'application/json' },
      });
    };
  }

  return <>{children}</>;
}
