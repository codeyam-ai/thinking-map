// How tall a field should be for what has been written in it.
//
// A textarea with a fixed row count hides the sentence someone is still
// composing: the first card's field held three rows, so a long idea scrolled
// inside it and most of what had been typed was out of sight at the moment it
// most needed reading back. Growing with the content fixes that in the
// direction people expect — down — and it is the CEILING that makes it safe,
// because a card that grew with an essay would run off the screen the essay
// was being typed onto.
//
// Pure, because the interesting part is the clamp and not the DOM poke. The
// component measures and assigns; this decides.

export function grownHeight({
  content,
  min,
  max,
}: {
  /** What the content actually needs — a measured `scrollHeight`. */
  content: number;
  /** The floor. The card's empty space is deliberate, and a field that
   *  collapsed to one line on an empty card would take it away. */
  min: number;
  /** The ceiling, past which the field goes back to scrolling. */
  max: number;
}): number {
  return Math.min(Math.max(content, min), max);
}
