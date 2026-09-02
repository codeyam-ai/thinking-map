/**
 * The muted line under the input saying what can be dropped on it.
 *
 * Doubles as the reading indicator: while a document is being extracted it says
 * so in the same place, because the person's attention is already there and a
 * second spinner elsewhere would only split it.
 *
 * The caller decides whether this line belongs on screen at all — it is hidden
 * once a brief is attached or the paste box is open, which is a fact about the
 * intake state rather than about this line.
 */
export default function IntakeHint({ reading }: { reading: boolean }) {
  return (
    <p className="mt-3 text-center text-[12.5px] text-muted">
      {reading
        ? 'Reading it…'
        : 'PDF, Word, Markdown, plain text or a link — or drop one here'}
    </p>
  );
}
