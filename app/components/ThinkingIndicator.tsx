// "Your partner is reading this."
//
// Shown in the gap between someone writing their idea and the first questions
// arriving. That gap is unavoidable and can be long: under WebMCP the page
// cannot ask an agent to hurry, and cannot even know one is coming. So the wait
// has to be legible, and it has to be legible in the right PLACE — a spinner in
// a corner says "the app is busy", which is a different claim than "someone is
// considering what you wrote".
//
// The dots sit on the axis the branches will grow along and travel outward, so
// the animation points at where the answer is about to appear. When the
// questions land they arrive along the path the waiting already traced.

export default function ThinkingIndicator({
  x,
  label = 'Reading your idea',
}: {
  /** Board-space x to start from — the right edge of the idea. */
  x: number;
  label?: string;
}) {
  return (
    <div
      className="pointer-events-none absolute -translate-y-1/2"
      style={{ left: x + 120, top: 0 }}
    >
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block rounded-full"
              style={{
                width: 26,
                height: 26,
                background: '#e4ec4b',
                // Staggered so the pulse reads as travelling outward rather
                // than as three lights blinking together.
                animation: `cy-think 1.5s ease-in-out ${i * 0.22}s infinite`,
              }}
            />
          ))}
        </div>
        <span
          className="text-[26px] font-medium"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
