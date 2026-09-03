'use client';

/** The collapsed dev panel: present enough to find, quiet enough to ignore.
 *  It sits over the map rather than in the layout because it is not part of
 *  the product — it exists only where a real agent cannot reach the page.
 *
 *  Bottom-LEFT, stacked above the zoom controls. It used to be bottom-right,
 *  which is the conversation's corner: at `z-40` against BoardChat's `z-30` it
 *  won every overlap, leaving about 12px between this pill and the chat above
 *  it. The board's own furniture belongs on the opposite side from the
 *  conversation — the same argument BoardZoomControls already makes for itself. */
export default function AgentPanelLauncher({ onOpen }: { onOpen(): void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      // Clears the zoom stack: three 40px buttons with 8px gaps sit 24px above
      // the board's own bottom inset, so their top edge lands near 192px.
      // `left-12` rather than `left-4`: this is fixed to the viewport while the
      // zoom stack is absolute inside the board's own inset, so the smaller
      // offset hung the pill off the black board onto the paper behind it.
      className="fixed bottom-[208px] left-12 z-40 rounded-full border border-line bg-surface px-3 py-1.5 text-[11px] uppercase tracking-wide text-muted shadow-sm hover:text-ink"
    >
      Agent panel
    </button>
  );
}
