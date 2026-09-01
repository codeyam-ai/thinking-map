import { approxPages } from '../lib/briefFormat';
import BriefExcerpt from './BriefExcerpt';
import BriefWarning from './BriefWarning';
import type { AttachedBrief } from './BriefDrop';

/**
 * What we are holding, before any map exists.
 *
 * This card is the point of the whole intake. It says where the document came
 * from, how much of it there is, and — through `BriefExcerpt` — what actually
 * came out of the file, so a client finds out their PDF was a scan HERE rather
 * than three questions into a map built on nothing.
 */
export default function BriefReadout({
  brief,
  onClear,
}: {
  brief: AttachedBrief;
  onClear: () => void;
}) {
  const pages = approxPages(brief.text.length);

  return (
    <div className="mt-5 rounded-[28px] border border-line bg-surface px-7 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">Brief attached</p>
        <button
          type="button"
          onClick={onClear}
          className="text-[13px] text-muted underline-offset-4 transition hover:text-ink hover:underline"
        >
          Remove
        </button>
      </div>

      <p className="mt-2 text-[15px] font-semibold text-ink">{brief.sourceName}</p>
      <p className="mt-1 text-[12.5px] text-muted">
        {brief.text.length.toLocaleString()} characters · about {pages} page
        {pages === 1 ? '' : 's'} of text
      </p>

      {brief.warning ? <BriefWarning text={brief.warning} /> : null}

      <BriefExcerpt text={brief.text} />
    </div>
  );
}
