/**
 * How far through the round you are.
 *
 * Deliberately just a count, with no action beside it. A button here would
 * invite skipping past questions the person has not looked at — while a round
 * is still being answered, the cards ARE the action, and this line only says
 * how many are left.
 */
export default function RowProgress({
  answered,
  questions,
}: {
  answered: number;
  questions: number;
}) {
  return (
    <p className="mb-8 text-[12.5px] text-muted">
      {answered} of {questions} answered
    </p>
  );
}
