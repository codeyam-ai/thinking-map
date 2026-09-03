'use client';

import { useCallback, useRef, useState } from 'react';
import AgentStatusDot from './AgentStatusDot';
import AgentStatusPanel from './AgentStatusPanel';
import { useWebMcpBridge } from './WebMcpBridge';
import { useDismissOnOutside } from '../hooks/useDismissOnOutside';

/**
 * Whether an agent can reach this page, stated plainly.
 *
 * One line, and nothing else. The tool count that used to sit here — "Agent
 * attached · 9 tools" — was answering a question nobody in front of a map is
 * asking; the number only matters when something about it is wrong, and then it
 * matters a lot. So it moved behind this line rather than out of the product:
 * the header states presence, and a click states the rest.
 *
 * `unavailable` is the ordinary case, not an error: WebMCP is top-level and
 * secure-context only, so a preview iframe, Safari, and any page opened without
 * a browser agent all land here.
 *
 * It sits in the header because agent presence is a fact about the whole page,
 * not about the exchange column it stands beside.
 */
export default function AgentStatus() {
  const bridge = useWebMcpBridge();
  const { status, reason, mapMissing } = bridge;
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  // A popover that cannot be dismissed the two ways every popover is dismissed
  // is a trap, and this one opens over a map the person is trying to read.
  const close = useCallback(() => setOpen(false), []);
  useDismissOnOutside(wrapper, open, close);

  const headline =
    status === 'connected'
      ? 'Agent attached'
      : status === 'working'
        ? 'Agent working…'
        : 'No agent attached';

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex items-center gap-2 rounded-full px-1 py-0.5 hover:bg-paper"
      >
        <AgentStatusDot status={status} />
        <span className="text-[12px] font-semibold text-ink">{headline}</span>
        {/* The one exception to the single line. Every other reason is context a
            person can go looking for; a map that no longer exists is an error
            they have to act on, and burying it behind a click would mean the
            page knows the tab is dead and declines to say so. */}
        {mapMissing ? (
          <span className="max-w-[190px] truncate text-[11.5px] text-red-700">
            — map deleted, reload
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2">
          <AgentStatusPanel
            status={status}
            channel={bridge.channel}
            reason={reason}
            registered={bridge.registered}
            bindFailures={bridge.bindFailures}
            convention={bridge.convention}
            mapMissing={mapMissing}
          />
        </div>
      ) : null}
    </div>
  );
}
