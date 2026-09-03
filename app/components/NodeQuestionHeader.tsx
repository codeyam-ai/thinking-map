/**
 * What the composer is about, and the way out of it.
 *
 * The node's own words are repeated here rather than left to the map behind the
 * composer: the composer covers part of that map, and a person mid-sentence
 * should not have to move it to remember which pill they clicked.
 */
export default function NodeQuestionHeader({
  label,
  onClose,
  tone = 'light',
}: {
  label: string;
  onClose: () => void;
  /** Which ground the composer is mounted on. The `eyebrow` class and
   *  `text-ink` are the app's paper palette; on the board's plane they render
   *  near-black on near-black. */
  tone?: 'light' | 'dark';
}) {
  const dark = tone === 'dark';
  return (
    <header className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <span
          className={
            dark
              ? 'block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35'
              : 'eyebrow block'
          }
        >
          Ask about
        </span>
        {/* Truncated rather than wrapped: a long node label should not push the
            field out of view, and the full text is on the pill itself. */}
        <span
          className={`block truncate text-[13px] font-semibold ${
            dark ? 'text-white' : 'text-ink'
          }`}
        >
          {label}
        </span>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`shrink-0 rounded-full px-1.5 text-[13px] leading-none transition-colors ${
          dark
            ? 'text-white/40 hover:text-white'
            : 'text-muted hover:text-ink'
        }`}
      >
        ×
      </button>
    </header>
  );
}
