/** The mark: three nodes and the connectors between them. */
export default function Wordmark() {
  return (
    <a
      href="/"
      suppressHydrationWarning
      className="flex shrink-0 items-center gap-2.5 whitespace-nowrap"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
        <path
          d="M11 4 L4.5 17 M11 4 L17.5 17 M6.5 13 L15.5 13"
          stroke="var(--ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="11" cy="4" r="2.4" fill="var(--ink)" />
        <circle cx="4.5" cy="17.5" r="2.2" fill="var(--ink)" />
        <circle cx="17.5" cy="17.5" r="2.2" fill="var(--ink)" />
      </svg>
      {/* Under ~520px the glyph stands alone. A mark that wraps mid-name reads
          as broken in a way a mark on its own does not. */}
      <span className="hidden text-[15px] font-extrabold tracking-[-0.01em] min-[520px]:inline lg:text-[17px]">
        Thinking Map
      </span>
    </a>
  );
}
