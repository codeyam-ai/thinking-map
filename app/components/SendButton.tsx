/**
 * The lime circular send button with its ↗ arrow — the only place lime appears
 * on the landing screen, and the same control the conversation panel uses.
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
      className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-lime text-ink transition hover:bg-lime-deep disabled:opacity-40 ${
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
