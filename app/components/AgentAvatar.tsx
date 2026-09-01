/** The small dark disc that marks a turn as the thinking partner's. */
export default function AgentAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink"
    >
      <svg width="12" height="12" viewBox="0 0 12 12">
        <circle cx="4" cy="4.5" r="1.4" fill="var(--paper)" />
        <circle cx="8" cy="4.5" r="1.4" fill="var(--paper)" />
        <circle cx="6" cy="8.5" r="1.4" fill="var(--paper)" />
      </svg>
    </span>
  );
}
