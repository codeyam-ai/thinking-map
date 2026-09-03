// What a way forward would take, and what taking it would cost you.
//
// The far end of the map offers several things you could do — an experiment to
// run, a slice to build, a direction to take — and until now it offered them
// as bare labels. "Ten words on paper cards, one classroom" and "One teacher
// runs a round and sees the scores" are not comparable as sentences; the
// question a person actually has is which is easier, which is cheaper, what
// each one needs, and what makes one better than the other. That question was
// unanswerable on screen.
//
// So it is STRUCTURED rather than folded into the detail line, and the reason
// is comparison. Two options with their effort described in prose cannot be
// read against each other without the reader doing the extraction themselves,
// which is exactly the work the card is there to save. Structured, the same
// question sits in the same place on every card and the eye can run down a
// column.
//
// Nothing here is validated against a scale. "About two days" is the partner's
// own sentence, printed as written — a rough estimate a person can argue with
// is more honest than a number that merely looks computed, which is the rule
// the build sequence's effort note already keeps.

export interface Tradeoffs {
  /** Roughly what it takes to do. The partner's own words. */
  effort?: string;
  /** What it costs, in whatever unit the partner thought was honest. */
  cost?: string;
  /** What has to be true or in hand before this is possible at all. */
  requires?: string[];
  /** What makes this the better of the alternatives. */
  betterWhen?: string;
  /** And what makes it the worse. Both, or the pair is a pitch. */
  worseWhen?: string;
}

/** One line on a card: what the fact is about, and the fact. */
export interface TradeoffBullet {
  label: string;
  value: string;
}

const text = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

/**
 * Read the stored tradeoffs, or nothing.
 *
 * Total, and degrading to null, exactly like the other JSON columns: a card
 * that cannot render its tradeoffs is still a thing worth trying, and one that
 * took the board down with it would not be.
 *
 * An object with nothing usable in it reads as nothing rather than as an empty
 * one. A card that drew a heading over no bullets would be announcing thinking
 * that had not happened, which is the failure this whole field exists to stop.
 */
export function readTradeoffs(
  raw: string | null | undefined,
): Tradeoffs | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const d = parsed as Record<string, unknown>;

    const requires = Array.isArray(d.requires)
      ? d.requires.map((r) => text(r)).filter((r): r is string => Boolean(r))
      : [];

    const out: Tradeoffs = {};
    const effort = text(d.effort);
    const cost = text(d.cost);
    const betterWhen = text(d.betterWhen);
    const worseWhen = text(d.worseWhen);
    if (effort) out.effort = effort;
    if (cost) out.cost = cost;
    if (requires.length) out.requires = requires;
    if (betterWhen) out.betterWhen = betterWhen;
    if (worseWhen) out.worseWhen = worseWhen;

    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * The bullets, split into what the card shows and what is behind "dig in".
 *
 * The order is the order the questions get asked. Effort and cost lead because
 * those two decide whether the rest is worth reading at all; what it needs
 * comes next, because a requirement you cannot meet ends the conversation; the
 * comparison last, because it only matters once the thing is possible.
 *
 * Each requirement gets its own bullet rather than a comma-joined line — they
 * are separate things you either have or do not, and a list reads as a
 * checklist where a sentence reads as a caveat.
 */
export function tradeoffBullets(
  tradeoffs: Tradeoffs,
  visible: number,
): { shown: TradeoffBullet[]; hidden: TradeoffBullet[] } {
  const all: TradeoffBullet[] = [];
  if (tradeoffs.effort) all.push({ label: 'Effort', value: tradeoffs.effort });
  if (tradeoffs.cost) all.push({ label: 'Cost', value: tradeoffs.cost });
  for (const need of tradeoffs.requires ?? []) {
    all.push({ label: 'Needs', value: need });
  }
  if (tradeoffs.betterWhen) {
    all.push({ label: 'Better when', value: tradeoffs.betterWhen });
  }
  if (tradeoffs.worseWhen) {
    all.push({ label: 'Worse when', value: tradeoffs.worseWhen });
  }

  return { shown: all.slice(0, visible), hidden: all.slice(visible) };
}
