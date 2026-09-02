/**
 * The person's own words, handed back to them.
 *
 * Its own component because of the decision it owns: a map started from a
 * document rather than a sentence has no seed idea, and rendering empty quote
 * marks around nothing would look like the text was lost — the precise anxiety
 * this panel exists to answer. Blank in, nothing out.
 */
export default function SeedIdeaQuote({ seedIdea }: { seedIdea?: string }) {
  const idea = seedIdea?.trim();
  if (!idea) return null;

  return (
    <p className="mt-4 border-l-2 border-line pl-4 text-[14px] italic leading-[1.55]">
      “{idea}”
    </p>
  );
}
