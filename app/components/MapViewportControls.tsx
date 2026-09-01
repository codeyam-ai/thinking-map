/** Shared by the two zoom buttons — a constant rather than a wrapper
 *  component, so the pair stays identical without introducing a component that
 *  exists only to hold a class string. */
const ZOOM_BUTTON =
  'flex h-6 w-6 items-center justify-center rounded-full text-[13px] font-semibold text-ink-soft transition-colors hover:bg-paper hover:text-ink';

/**
 * The zoom cluster that sits over the bottom-right corner of the map.
 *
 * It states the current scale as a number because the map has no other way to
 * say where it is: at 66% and at 136% the same tree is on screen, and only the
 * readout distinguishes "this is everything" from "this is a detail".
 */
export default function MapViewportControls({
  scale,
  isCustom,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  scale: number;
  /** Whether the viewport is the person's rather than the automatic fit. */
  isCustom: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  return (
    <div className="absolute bottom-5 right-5 flex items-center gap-1 rounded-full border border-line bg-surface/95 px-1.5 py-1 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className={ZOOM_BUTTON}
      >
        −
      </button>
      <span className="w-11 text-center text-[11px] font-semibold tabular-nums text-ink-soft">
        {Math.round(scale * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className={ZOOM_BUTTON}
      >
        +
      </button>
      <button
        type="button"
        onClick={onFit}
        // Disabled while the viewport is already the auto-fit: there is nothing
        // to reset, and a live button would leave the person wondering what it
        // did.
        disabled={!isCustom}
        className="ml-0.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-soft transition-colors hover:bg-paper hover:text-ink disabled:pointer-events-none disabled:opacity-40"
      >
        Fit
      </button>
    </div>
  );
}
