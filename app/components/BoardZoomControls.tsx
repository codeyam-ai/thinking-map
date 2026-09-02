'use client';

// Zoom, fixed to the viewport rather than to the board plane.
//
// That distinction is the reason this is not just three buttons: everything
// else on the board is inside the transform being zoomed, so a control that
// rode along would shrink exactly when you most needed it. It also carries
// `data-no-pan`, or dragging on the buttons would pan the map underneath.
//
// Bottom-LEFT, because the conversation lives in the opposite corner. The two
// used to share one, which is what made the board's own controls feel like part
// of the chat rather than part of the map.

export default function BoardZoomControls({
  onZoomIn,
  onZoomOut,
  onFrameAll,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Pull the whole board back into view — the way out of being lost. */
  onFrameAll: () => void;
}) {
  return (
    <div className="absolute bottom-6 left-6 flex flex-col gap-2" data-no-pan>
      <button
        onClick={onZoomIn}
        className="h-10 w-10 rounded-lg border border-white/15 bg-black/70 text-lg text-white/80 hover:text-white"
        aria-label="Zoom in"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="h-10 w-10 rounded-lg border border-white/15 bg-black/70 text-lg text-white/80 hover:text-white"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        onClick={onFrameAll}
        className="h-10 w-10 rounded-lg border border-white/15 bg-black/70 text-[10px] uppercase tracking-wide text-white/70 hover:text-white"
        aria-label="Frame the whole board"
      >
        All
      </button>
    </div>
  );
}
