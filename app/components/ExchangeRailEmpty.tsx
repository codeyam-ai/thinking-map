/**
 * The activity rail before anything has happened.
 *
 * Per the design system an empty state describes the next action rather than
 * the absence of data — and here that matters more than usual, because a person
 * arriving with no agent attached has no other cue that the map is something
 * two parties write to.
 */
export default function ExchangeRailEmpty() {
  return (
    <p className="text-[12.5px] leading-snug text-muted">
      Nothing yet. Attach a browser agent to this page, or add to the map
      yourself — everything either of you does shows up here.
    </p>
  );
}
