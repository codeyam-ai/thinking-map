import AskAboutSectionButton from './AskAboutSectionButton';
import { formatCharCount } from '../lib/briefFormat';
import type { SectionCoverage } from '../lib/briefCoverage';

/**
 * One section of the brief, and what the map has to say about it.
 *
 * The weighting here is deliberately the inverse of the obvious one: the
 * sections nobody has touched carry the ink, and the ones already accounted for
 * recede. The covered sections have done their job — the map beside this panel
 * is their evidence. What is left for this row to say is what nobody has dealt
 * with, and rendering that as the quietest thing on the panel would bury the
 * one finding a client is owed.
 *
 * It is not lime and not red on purpose. Lime marks exactly one thing per
 * screen — the thing that just changed — and red would read as a defect rather
 * than a prompt. Weight and ink are the axis left, so this uses those.
 */
export default function BriefSectionRow({
  section,
  onAsk,
}: {
  section: SectionCoverage;
  /** Absent when there is no agent to ask — the row then simply omits the
   *  affordance rather than offering a button that goes nowhere. */
  onAsk?: (section: SectionCoverage) => void;
}) {
  // An empty section is neither: there is nothing in it to have accounted for,
  // so it stays listed — the document's shape includes it — but it neither
  // carries the ink nor recedes into the covered grey.
  const untouched = section.nodeCount === 0 && !section.isEmpty;

  return (
    <li className="flex items-start gap-2.5 border-t border-line py-3 first:border-t-0">
      <span
        className={`min-w-[22px] pt-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] tabular-nums ${
          untouched ? 'text-ink' : 'text-line'
        }`}
      >
        {section.id}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={
            untouched
              ? 'text-[13.5px] font-bold leading-snug text-ink'
              : 'text-[13px] font-medium leading-snug text-muted'
          }
        >
          {section.heading}
        </p>
        <p
          className={`mt-0.5 text-[11.5px] tabular-nums ${
            untouched ? 'font-medium text-ink-soft' : 'text-line'
          }`}
        >
          {section.isEmpty
            ? 'empty section'
            : `${formatCharCount(section.charCount)} chars`}
          {untouched ? ' · nothing cites this' : null}
        </p>

        {untouched && onAsk ? (
          <AskAboutSectionButton
            sectionId={section.id}
            heading={section.heading}
            onClick={() => onAsk(section)}
          />
        ) : null}
      </div>

      <span
        className={`flex h-[22px] min-w-[26px] items-center justify-center rounded-full px-2 text-[11.5px] tabular-nums ${
          untouched
            ? 'border-[1.5px] border-dashed border-ink font-bold text-ink'
            : 'border border-line font-medium text-muted'
        }`}
        /* The count is the fact; the title says what the fact means, because
           "0" alone does not distinguish "nothing cites this" from "this
           section is empty". */
        title={
          section.isEmpty && section.nodeCount === 0
            ? 'A heading with nothing under it — nothing to account for'
            : untouched
              ? 'No node on the map cites this section'
              : `${section.nodeCount} node${section.nodeCount === 1 ? '' : 's'} cite this section`
        }
      >
        {section.nodeCount}
      </span>
    </li>
  );
}
