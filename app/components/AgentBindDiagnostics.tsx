// The half of the panel that was only ever for whoever is building this.
//
// This is where the bottom-left dev badge ended up. A permanent readout was the
// right information in the wrong place — it sat over the board, it was there
// whether or not anyone wanted it, and on a screen whose whole job is to show a
// map it spent its rows saying nothing had changed.
//
// What it knows that nothing else does is which tools the browser REFUSED. That
// silence is the bug the whole feature exists to end: a binding that registered
// nothing was indistinguishable from one that worked, which is precisely how
// the header came to report "Agent attached · 9 tools" over zero tools.
//
// Owns its own environment gate, so `AgentStatusPanel` stays a plain
// composition with no `NODE_ENV` branch in it.

import type { AgentChannel } from '@/app/lib/agentPresence';
import type { BridgeStatus } from './WebMcpBridge';

export default function AgentBindDiagnostics({
  status,
  channel,
  convention,
  bindFailures,
}: {
  status: BridgeStatus;
  channel: AgentChannel | null;
  /** Which registration convention the browser offered, if any. */
  convention: 'registerTool' | 'provideContext' | null;
  bindFailures: { name: string; reason: string }[];
}) {
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-muted">
      <div>
        api {convention ?? 'none'} · channel {channel ?? 'none'} · status{' '}
        {status}
      </div>
      {bindFailures.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-red-700">
          {bindFailures.map((f) => (
            <li key={f.name}>
              {f.name} — {f.reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
