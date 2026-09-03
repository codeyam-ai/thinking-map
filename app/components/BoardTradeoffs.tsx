'use client';

// What a thing would take, and what taking it would cost you.
//
// A few bullets, and a way to see the rest. Both halves of that are load
// bearing. The card is something you SCAN while holding it against the option
// below it, so printing everything known about an approach would turn a
// shortlist into a wall and make the comparison harder rather than easier —
// and hiding the rest behind a control rather than dropping it means the
// person who has narrowed it to two can still get the whole picture on both.
//
// Effort and cost lead because those two decide whether the rest is worth
// reading. What it needs comes next, because a requirement you cannot meet
// ends the conversation. The comparison is last, because "better when" only
// matters once the thing is possible at all. That order lives in
// `tradeoffBullets`, where a test holds it.
//
// Every value is printed as the partner wrote it. Nothing is normalised to a
// scale, and nothing is compared for you: "about two days" against "a couple
// of weeks" is a judgement a person makes in a second and a machine gets
// confidently wrong.

import { useState } from 'react';
import {
  readTradeoffs,
  tradeoffBullets,
  type Tradeoffs,
} from '@/app/lib/tradeoffs';

/** How many stand on the card before the rest go behind the control. Two is
 *  enough to compare two options at a glance and few enough that a list of
 *  four options still reads as a list. */
const VISIBLE = 2;

export default function BoardTradeoffs({
  tradeoffs,
}: {
  /** The parsed object, or the raw JSON string the column holds. Both are
   *  accepted for the reason `fromNodeIds` is: the server reads straight off
   *  the row and the client usually has it parsed already. This is the one
   *  place that reads the field, so this is where the two meet. */
  tradeoffs: Tradeoffs | string | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  const parsed =
    typeof tradeoffs === 'string' ? readTradeoffs(tradeoffs) : tradeoffs;

  // Nothing worth showing renders nothing — never a heading over no bullets,
  // which would announce thinking that has not happened.
  if (!parsed) return null;

  const { shown, hidden } = tradeoffBullets(parsed, VISIBLE);
  if (shown.length === 0) return null;

  const rows = open ? [...shown, ...hidden] : shown;

  return (
    <div className="mt-1 flex flex-col gap-1">
      <dl className="flex flex-col gap-1">
        {rows.map((row) => (
          <div
            key={`${row.label}:${row.value}`}
            className="flex gap-2 text-[12.5px] leading-snug"
          >
            {/* A fixed column so the same question sits in the same place on
                every card — which is the whole reason these are structured
                rather than a sentence. The eye runs down the labels. */}
            <dt className="w-[74px] shrink-0 text-white/35">{row.label}</dt>
            <dd className="min-w-0 break-words text-white/70">{row.value}</dd>
          </div>
        ))}
      </dl>

      {hidden.length > 0 ? (
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="self-start text-[12px] font-semibold text-white/45 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          {open ? 'Less' : `Dig in · ${hidden.length} more`}
        </button>
      ) : null}
    </div>
  );
}
