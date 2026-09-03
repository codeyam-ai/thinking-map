'use client';

/**
 * The ways forward an insight offers.
 *
 * Taking one is NOT answering: no question on the map is being closed, a
 * direction is being taken, and what the partner does next depends on which.
 * `BoardWorkspace` records it as a `user.note` for exactly that reason — an
 * answer would have to name the question it answered, and there isn't one.
 *
 * Renders nothing when the partner named a direction without proposing routes.
 * The thinking can still continue by other means, and an empty row where the
 * buttons would have been says the opposite.
 */
import InsightSectionLabel from './InsightSectionLabel';

export default function InsightWaysForward({
  choices,
  hue,
  onChoose,
}: {
  choices: string[] | null | undefined;
  hue: number;
  onChoose?: (choice: string) => void;
}) {
  if (!choices?.length) return null;

  return (
    // `data-no-pan` because the board underneath is a drag surface: without it,
    // a press that starts on a button and moves a few pixels pans the plane
    // instead of clicking.
    <section data-no-pan>
      <InsightSectionLabel className="mb-2">Where next</InsightSectionLabel>
      <div className="flex flex-col gap-2">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={(event) => {
              // The card above toggles on click and this button is inside it:
              // without the stop, taking a way forward would also close the
              // card it was taken from.
              event.stopPropagation();
              onChoose?.(choice);
            }}
            className="rounded-full px-4 py-2.5 text-left text-[13.5px] font-semibold text-black transition-transform hover:scale-[1.02]"
            style={{ background: `hsl(${hue} 82% 66%)` }}
          >
            {choice}
          </button>
        ))}
      </div>
    </section>
  );
}
