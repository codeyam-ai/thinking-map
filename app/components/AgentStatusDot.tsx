import type { BridgeStatus } from './WebMcpBridge';

/** Lime for a live agent, pulsing while it is mid-call, and the plain line
 *  colour when none is attached — absence is the ordinary case here, not a
 *  fault, so it gets a neutral treatment rather than a warning one. */
const DOT: Record<BridgeStatus, string> = {
  connected: 'bg-lime-deep',
  working: 'bg-lime-deep animate-pulse',
  unavailable: 'bg-line',
};

export default function AgentStatusDot({ status }: { status: BridgeStatus }) {
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`}
      aria-hidden="true"
    />
  );
}
