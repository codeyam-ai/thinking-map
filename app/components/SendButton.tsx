/**
 * The circular send button with its ↗ arrow — the landing screen's control, and
 * the same one every composer on the board reaches for.
 *
 * Ink, not lime. Lime now says exactly two things in this product: the ring on
 * the node that just changed, and the agent's status dot. A call to action
 * wearing it would compete with the one mark on a screen that is meant to be
 * found by colour alone.
 *
 * There is deliberately no second tone, and the reason is worth recording. The
 * rule for calls to action is surface-dependent — ink on paper, white on the
 * board — but every caller of THIS button renders it over a `bg-surface` field.
 * The composers sit on dark cards; the field under the button is white in all
 * four. So the pill is ink everywhere it appears, and a board tone would have
 * had no caller.
 */
export default function SendButton({
  disabled,
  label,
  size = 'small',
}: {
  disabled: boolean;
  label: string;
  size?: 'small' | 'large';
}) {
  const large = size === 'large';
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-ink text-paper transition hover:bg-ink-soft disabled:opacity-40 ${
        large ? 'right-4 h-[52px] w-[52px]' : 'right-2.5 h-[38px] w-[38px]'
      }`}
    >
      <svg
        width={large ? 20 : 16}
        height={large ? 20 : 16}
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          d="M5 15 L15 5 M7.5 5 H15 V12.5"
          stroke="currentColor"
          strokeWidth={large ? 2 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </button>
  );
}
