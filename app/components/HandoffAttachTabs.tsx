'use client';

import { useState } from 'react';
import AttachTabPanel from './AttachTabPanel';
import AttachTabStrip from './AttachTabStrip';
import type { HandoffAttachTab } from '../lib/handoffCopy';

/**
 * The ways to attach an agent, one at a time.
 *
 * Its own component because of the decision it owns: these are ALTERNATIVES,
 * not steps. Stacked, they read as a list of things to do and a reader cannot
 * tell which line is theirs — which is what made this panel feel like a wall of
 * instructions. Someone arrives already knowing their situation (agentic
 * browser / some agent / Claude Code), so the panel's job is to let them say
 * which, and then answer only that.
 *
 * The client boundary lives HERE rather than at `HandoffFootnote`, so the two
 * paragraphs above the strip stay server-rendered and the only thing shipped
 * for interactivity is the tab control itself.
 */
export default function HandoffAttachTabs({
  tabs,
}: {
  tabs: readonly HandoffAttachTab[];
}) {
  // Opens on `agent` when it is present: it is the only tab whose answer works
  // for every reader, where `browser` is the one whose answer is "not you, or
  // you could not be seeing this panel". Falling back to the first tab rather
  // than asserting keeps this renderer honest about a copy list it does not own.
  const [activeId, setActiveId] = useState(
    () => (tabs.find((t) => t.id === 'agent') ?? tabs[0])?.id,
  );
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  if (!active) return null;

  return (
    <div className="mt-3">
      <AttachTabStrip tabs={tabs} activeId={active.id} onSelect={setActiveId} />
      <AttachTabPanel tab={active} />
    </div>
  );
}
