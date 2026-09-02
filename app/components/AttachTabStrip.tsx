'use client';

import type { HandoffAttachTab } from '../lib/handoffCopy';

/**
 * The row of three labels that choose which way in is on screen.
 *
 * Its own component because it is the half of the tab control that must stay
 * an ARIA `tablist`: the panel below it is `aria-controls`-referenced from
 * here, and splitting the two is what keeps the roles, ids and `aria-selected`
 * wiring in one readable place rather than tangled with the panel's content.
 *
 * Underline rather than the filled pills `ContributionTabs` uses. That control
 * is a two-value toggle in a compact composer bar; this one sits inside a band
 * that already carries a heavy lime border, where a second set of filled,
 * enclosing shapes reads as a panel within a panel. The two are deliberately
 * different, not accidentally inconsistent.
 */
export default function AttachTabStrip({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: readonly HandoffAttachTab[];
  activeId: HandoffAttachTab['id'];
  onSelect(id: HandoffAttachTab['id']): void;
}) {
  return (
    <div
      role="tablist"
      aria-label="How to attach an agent"
      className="flex gap-1 border-b border-line"
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`attach-tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`attach-panel-${tab.id}`}
            onClick={() => onSelect(tab.id)}
            className={
              selected
                ? // `-mb-px` pulls the active underline down onto the strip's
                  // own bottom border so the two read as one line with a
                  // thickened segment, rather than as two stacked rules.
                  '-mb-px border-b-2 border-ink px-3 py-2 text-[12px] font-semibold text-ink'
                : 'px-3 py-2 text-[12px] text-muted'
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
