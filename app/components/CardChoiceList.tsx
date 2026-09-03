'use client';

// The shortlist on a question card.
//
// Every list the partner writes is a guess about what you might say, and the
// guess must never be the only thing you are allowed to say. It used to be
// exactly that, in both directions: picking an option SUBMITTED, so you could
// take one and only one, and the way past the list replaced the list, so you
// could reject the guess entirely or accept it whole.
//
// Real answers are not shaped like that. "Two of those" is ordinary, and "one
// of those, with a qualification" is what most answers are. So the options
// toggle rather than submit, the box for your own words sits underneath rather
// than instead, and one Save records the combination.
//
// The list scrolls and nothing else does. A card is a fixed size on the board
// but the partner decides how many options to write, so the only two honest
// choices are to clip something or to scroll — and scrolling DOWN is the only
// direction anything on a card may move, because a horizontal scrollbar hides
// content in the axis nobody thinks to look in.

export default function CardChoiceList({
  choices,
  picked,
  onToggle,
  light,
}: {
  choices: string[];
  /** The options taken so far. Plural, and that is the change. */
  picked: string[];
  onToggle: (choice: string) => void;
  /** True on an open card, which is saturated in the theme colour and takes
   *  dark text; false on the near-black surface of one being amended. */
  light: boolean;
}) {
  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {choices.map((choice) => {
        const on = picked.includes(choice);
        return (
          <button
            key={choice}
            type="button"
            onClick={() => onToggle(choice)}
            aria-pressed={on}
            // A taken option is FILLED and an untaken one outlined, so the set
            // you have built reads at a glance. On the light card that means
            // ink on white; on the dark one, white on near-black. A checkmark
            // instead of a fill was the alternative and says the same thing in
            // a glyph you have to find.
            className="shrink-0 break-words rounded-full border px-4 py-2 text-left text-[13.5px] font-semibold transition-transform hover:scale-[1.02]"
            style={{
              background: on
                ? light
                  ? '#000'
                  : 'rgba(255,255,255,0.92)'
                : 'transparent',
              color: on
                ? light
                  ? '#fff'
                  : '#000'
                : light
                  ? 'rgba(0,0,0,0.8)'
                  : 'rgba(255,255,255,0.8)',
              borderColor: light
                ? 'rgba(0,0,0,0.45)'
                : 'rgba(255,255,255,0.35)',
            }}
          >
            {choice}
          </button>
        );
      })}
    </div>
  );
}
