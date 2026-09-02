// A small flow drawn on a card.
//
// The partner describes a SHAPE — steps and their order — and this decides what
// it looks like. That split is the point. The alternative is letting a model
// emit SVG or HTML, which means arbitrary markup reaching the DOM and a diagram
// whose styling depends on how the model happened to feel; here a diagram can
// only ever be drawn in the board's own colours, at the board's own weight, and
// there is nothing to sanitise because nothing arbitrary arrives.
//
// Vertical, not horizontal: a card is 300 wide and 360 tall, so stacking is the
// only orientation where four steps stay legible.

export default function CardDiagram({
  steps,
  note,
  accent,
}: {
  steps: string[];
  note?: string;
  /** The owning theme's colour, so a diagram belongs to its line of thinking. */
  accent: string;
}) {
  return (
    <div className="mt-3">
      {steps.map((step, i) => (
        <div key={`${i}-${step}`}>
          <div
            className="rounded-[9px] px-3 py-2 text-[12px] font-semibold leading-tight"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: `1px solid ${accent}`,
              color: '#fff',
            }}
          >
            {step}
          </div>
          {/* The arrow, between boxes only — a trailing one would point at
              nothing and read as a step the partner forgot to name. */}
          {i < steps.length - 1 ? (
            <div className="flex justify-center py-1" aria-hidden="true">
              <svg width="11" height="13" viewBox="0 0 12 14" fill="none">
                <path
                  d="M6 0v11M2 8l4 4 4-4"
                  stroke={accent}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}
        </div>
      ))}

      {note ? (
        <p className="mt-2.5 text-[12px] leading-relaxed text-white/55">{note}</p>
      ) : null}
    </div>
  );
}
