'use client';

/** The collapsed dev panel: present enough to find, quiet enough to ignore.
 *  It sits over the map rather than in the layout because it is not part of
 *  the product — it exists only where a real agent cannot reach the page. */
export default function AgentPanelLauncher({ onOpen }: { onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed bottom-4 right-4 z-40 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted shadow-sm hover:text-ink"
    >
      Agent panel
    </button>
  );
}
