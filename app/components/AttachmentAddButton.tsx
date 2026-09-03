'use client';

// The way to bring something else along.
//
// Its own component because of the decision it owns: at the cap it DISAPPEARS
// rather than sitting there disabled. A control that is present and refuses
// teaches the person the limit by wasting their click; a control that is gone
// says the same thing before they reach for it, and the chips beside it already
// explain why. Removing one brings it back.
//
// Dashed rather than solid, because it is an invitation rather than an action
// on something that exists — the same reason an empty strip has to read as an
// offer instead of as a row where something failed to load.

export default function AttachmentAddButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-dashed border-white/20 px-3 py-1.5 text-[12px] text-white/45 hover:border-white/40 hover:text-white/80"
      >
        + Add
      </button>
    </li>
  );
}
