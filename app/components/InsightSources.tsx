/**
 * The questions an insight came out of.
 *
 * The reason the card opens at all. A claim about the whole idea is worth
 * exactly as much as the thinking behind it is visible, and the alternative to
 * showing this is asking the person to take the partner's word for it.
 *
 * Renders NOTHING when there are no citations — not an empty heading. An agent
 * that never learned the field, and an insight genuinely drawn from the whole
 * map, both produce that case, and "What this came out of" with nothing under
 * it reads as something that failed to load rather than as an honest absence.
 */
import InsightSectionLabel from './InsightSectionLabel';

export default function InsightSources({
  sources,
  hue,
}: {
  /** Already resolved against the map by `insightStream`, which drops the ids
   *  that name nodes since deleted rather than rendering them blank. */
  sources: { id: string; label: string }[];
  hue: number;
}) {
  if (sources.length === 0) return null;

  return (
    <section>
      <InsightSectionLabel className="mb-2">
        What this came out of
      </InsightSectionLabel>
      <ul className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <li
            key={source.id}
            // A rule in the row's own colour rather than a bullet: these are
            // quotations from elsewhere on the board, and the colour is what
            // says where from.
            className="border-l pl-3 text-[13px] leading-snug text-white/70"
            style={{ borderColor: `hsl(${hue} 80% 60% / 0.45)` }}
          >
            {source.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
