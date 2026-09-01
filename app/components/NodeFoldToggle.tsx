/**
 * The fold control on a node's bottom edge, where its branch leaves it.
 *
 * Its own element rather than a change to the pill's shell, so the
 * status-precedence rule nodeShellClasses owns is left undisturbed: a folded
 * node is still dashed if it is still an open question.
 *
 * It shows what folding costs — `+8` rather than a bare chevron — because the
 * count is the thing that tells you whether the branch is worth opening again.
 */
export default function NodeFoldToggle({
  label,
  collapsed,
  hiddenCount,
  onToggle,
}: {
  /** The node's own label, so the control names what it folds for a screen
   *  reader rather than announcing an anonymous button. */
  label: string;
  collapsed: boolean;
  /** The whole subtree, counted before any folding — so the number stays
   *  truthful while the branch is folded. */
  hiddenCount: number;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={
        collapsed ? `Unfold ${label} — ${hiddenCount} hidden` : `Fold ${label}`
      }
      aria-expanded={!collapsed}
      className="absolute -bottom-2.5 left-1/2 flex h-5 -translate-x-1/2 items-center justify-center rounded-full border border-line bg-surface px-1.5 text-[10px] font-semibold text-ink-soft transition-colors hover:border-thread hover:text-ink"
      style={{ minWidth: '1.25rem' }}
      // The pill beneath starts a drag on pointerdown; reaching for this
      // control is not a drag of the node it sits on.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      {collapsed ? `+${hiddenCount}` : '−'}
    </button>
  );
}
