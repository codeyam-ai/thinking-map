/**
 * The small-caps heading above a section of an opened insight.
 *
 * Its own component for the reason the fourth copy of a class string always is:
 * "What this came out of", "Where next", "Go deeper" and the stack's own eyebrow
 * were four hand-copies of the same six utilities, which is three chances for
 * one of them to drift a shade or a letter-spacing away from the others and no
 * way to notice.
 *
 * Deliberately NOT the app's `eyebrow` class. That one is the paper palette's
 * — near-black on white — and this heading only ever appears on the board's
 * plane, where it would render invisible.
 */
export default function InsightSectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  /** Spacing only. The type and colour are the point of the component and are
   *  not meant to be overridden from a call site. */
  className?: string;
}) {
  return (
    <span
      className={`block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35 ${className}`}
    >
      {children}
    </span>
  );
}
