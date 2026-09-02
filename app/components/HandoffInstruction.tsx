/**
 * What to do about a map nobody has picked up, said before anything explains
 * why nobody has.
 *
 * Its own component because of the decision it owns: the steps are an ORDERED
 * list, not a styled pair of lines. Their order is the content — copy, then
 * paste — and someone skimming a band on arrival reads the numbers before they
 * read the words. Rendering them as an unordered list or as prose would lose
 * the only thing that makes two short sentences into instructions.
 *
 * It is also the block whose POSITION is the point. The panel used to open
 * with the explanation and reach the prompt third; this is the piece that now
 * comes first, and keeping it separable is what lets a test assert that
 * ordering rather than merely assert both texts exist somewhere.
 */
export default function HandoffInstruction({
  eyebrow,
  instruction,
  steps,
}: {
  eyebrow: string;
  instruction: string;
  steps: readonly string[];
}) {
  return (
    <>
      <h2 className="eyebrow mb-2">{eyebrow}</h2>
      <p className="text-[22px] leading-[1.25] font-semibold">{instruction}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-[15px] leading-[1.5]">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </>
  );
}
