'use client';

// The shortlist on a question card, and the way past it.
//
// Every list the partner writes is a guess about what you might say, and the
// guess must never be the only thing you are allowed to say. So this component
// is really two things that must both survive: the options, and an escape from
// them — and the escape is the one that must never be what falls off the
// bottom of a fixed-size card.

export default function CardChoiceList({
  choices,
  onPick,
  onOther,
  light,
}: {
  choices: string[];
  /** Picking answers immediately: a chosen option is already the whole answer,
   *  and asking someone to confirm it adds a step carrying no information. */
  onPick: (choice: string) => void;
  /** Open the free-text box instead. */
  onOther: () => void;
  /** True on an open card, which is saturated in the theme colour and takes
   *  dark text; false on the near-black surface of one being amended. */
  light: boolean;
}) {
  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {/* The options scroll; the way past them does not. A card is a fixed size
          on the board but the partner decides how many options to write, so the
          only two honest choices are to clip something or to scroll. Clipping
          took the escape hatch with it. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {choices.map((choice) => (
          <button
            key={choice}
            type="button"
            onClick={() => onPick(choice)}
            className="shrink-0 rounded-full px-4 py-2.5 text-left text-[14px] font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: light ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.1)',
              color: light ? '#000' : '#fff',
            }}
          >
            {choice}
          </button>
        ))}
      </div>

      {/* Spelled out in words rather than left as a grey box captioned "Other…",
          and outlined rather than filled so it reads as a different KIND of
          thing from the options above it rather than as one more of them. */}
      <button
        type="button"
        onClick={onOther}
        className="mt-2.5 shrink-0 rounded-full border border-dashed px-4 py-2.5 text-left text-[13.5px] font-semibold transition-opacity hover:opacity-100"
        style={{
          borderColor: light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)',
          color: light ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.72)',
        }}
      >
        Say something else…
      </button>
    </div>
  );
}
