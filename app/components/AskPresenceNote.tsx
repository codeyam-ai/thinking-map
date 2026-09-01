import { askPresence } from '../lib/askPresence';

/**
 * The line that says what sending this question will actually do.
 *
 * Its own component because it is the part of the composer that has to be
 * honest: WebMCP is pull-only, so an asked question reaches an agent that is
 * already waiting and reaches nobody at all otherwise. The wording itself lives
 * in `askPresence`, where tests can pin it.
 */
export default function AskPresenceNote({ listening }: { listening: boolean }) {
  return (
    <p className="mt-2 text-[11px] leading-snug text-muted">
      {askPresence(listening).note}
    </p>
  );
}
