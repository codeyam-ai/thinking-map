'use client';

import AgentCallLogRow, { type AgentCallLine } from './AgentCallLogRow';

export type { AgentCallLine };

/**
 * The transcript of what the stand-in agent actually called.
 *
 * This is the evidence that the dev panel drives the real bound catalog rather
 * than a simulation of it: every reply here is the tool's own, returned through
 * the same path a browser agent's call takes.
 */
export default function AgentCallLog({ lines }: { lines: AgentCallLine[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto rounded-[10px] bg-paper p-2">
      {lines.length === 0 ? (
        <p className="text-[11px] text-muted">No calls yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {lines.map((line, i) => (
            <AgentCallLogRow key={i} line={line} />
          ))}
        </ul>
      )}
    </div>
  );
}
