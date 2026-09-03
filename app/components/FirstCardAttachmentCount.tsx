'use client';

/**
 * How many things the first card is carrying, said out loud.
 *
 * Only once the strip can no longer show them all. Below the threshold this
 * would be arithmetic about four chips a person can already see, which is
 * noise on a card whose emptiness is deliberate; past it, the strip scrolls
 * and this line is the only thing saying that what went out of sight is still
 * attached rather than dropped.
 *
 * The threshold lives here, next to the sentence it governs, rather than in
 * the parent — the rule and the words it produces are one thing.
 */
const SHOW_COUNT_ABOVE = 4;

export default function FirstCardAttachmentCount({ total }: { total: number }) {
  if (total <= SHOW_COUNT_ABOVE) return null;

  return (
    <p className="mb-1.5 text-[11px] font-medium text-black/55">
      {total} attached
    </p>
  );
}
