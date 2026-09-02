import { firstLines } from '../lib/briefFormat';

/** How much of the document to show. Enough to recognise it, not enough to
 *  read it — this is a proof of extraction, not a preview pane. */
const LINES_SHOWN = 4;

/**
 * The opening lines of the brief, exactly as they were extracted.
 *
 * Verbatim on purpose, markdown marks and all: the claim being made is "this
 * is what we got out of your file", and prettifying it would undermine the one
 * thing it is here to prove. A file that yielded nothing shows "(nothing)",
 * which is the signal the person needs.
 */
export default function BriefExcerpt({ text }: { text: string }) {
  return (
    <>
      <p className="eyebrow mt-5">What we read</p>
      <pre className="mt-2 max-h-[132px] overflow-hidden whitespace-pre-wrap font-sans text-[13px] leading-[1.55] text-ink-soft">
        {firstLines(text, LINES_SHOWN) || '(nothing)'}
      </pre>
    </>
  );
}
