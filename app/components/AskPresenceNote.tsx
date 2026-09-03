import { askPresence } from '../lib/askPresence';

/**
 * The line that says what sending this question will actually do.
 *
 * Its own component because it is the part of the composer that has to be
 * honest: WebMCP is pull-only, so an asked question reaches an agent that is
 * already waiting and reaches nobody at all otherwise. The wording itself lives
 * in `askPresence`, where tests can pin it.
 */
export default function AskPresenceNote({
  listening,
  tone = 'light',
}: {
  listening: boolean;
  /** Which ground this is printed on. The sentence is the same either way —
   *  only its colour changes, because `text-muted` on the board's near-black
   *  plane is the honest line rendered invisible. */
  tone?: 'light' | 'dark';
}) {
  return (
    <p
      className={`mt-2 text-[11px] leading-snug ${
        tone === 'dark' ? 'text-white/45' : 'text-muted'
      }`}
    >
      {askPresence(listening).note}
    </p>
  );
}
