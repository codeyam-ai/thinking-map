'use client';

// Supply a fixed bridge state to an isolated capture.
//
// The real bridge derives its state from the browser, and an isolated capture
// renders in an iframe where WebMCP is unreachable by definition — so
// `unavailable` is the ONLY state it could ever produce on its own. Every other
// state the exchange column exists to show is reachable only by providing it,
// which is what this does. It is the same argument as the headless agent
// driver: not a mock of the feature, but the only way to see the feature where
// it must be seen.
//
// It lives beside the isolation routes, like `WebMcpBridge/BridgeReadout`,
// because it exists only to give those routes something to render — the
// production bridge should not carry a capture-only seam.

import { useMemo } from 'react';
import {
  BridgeContext,
  type BridgeState,
} from '@/app/components/WebMcpBridge';

export default function BridgeFixture({
  children,
  ...overrides
}: Partial<BridgeState> & { children?: React.ReactNode }) {
  const value = useMemo<BridgeState>(
    () => ({
      status: 'unavailable',
      channel: null,
      lastAgentAt: null,
      mapMissing: false,
      reason: 'running inside an iframe',
      pending: [],
      tools: [],
      registered: [],
      bindFailures: [],
      convention: null,
      revision: null,
      events: [],
      answer: async () => {},
      contribute: async () => {},
      ...overrides,
    }),
    // A scenario's overrides are literals rebuilt on every render, so the
    // identity of the object is meaningless; what actually varies between
    // captures is the state and how far the log has got.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides.status, overrides.revision, overrides.events?.length],
  );

  return (
    <BridgeContext.Provider value={value}>{children}</BridgeContext.Provider>
  );
}
