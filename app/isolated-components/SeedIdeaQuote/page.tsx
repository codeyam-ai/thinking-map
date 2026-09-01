import Component from "../../../app/components/SeedIdeaQuote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The person's own words, handed back to them.
//
// The blank case is deliberately NOT a scenario: it renders nothing by design,
// so it would capture as an empty frame indistinguishable from a broken one.
// That decision is pinned in handoffCopy.test.ts and the AgentHandoff render
// tests instead. What is worth looking at here is how the quote holds up at
// the lengths a real seed idea actually arrives in.
const scenarios: Record<string, Props> = {
  // The ordinary case — one sentence, the shape most ideas are typed in.
  Default: { seedIdea: "A weekend app for splitting chores fairly" },
  // A long one, where the left rule and the wrapping have to keep the quote
  // readable rather than letting it run as a wall.
  LongIdea: {
    seedIdea:
      "Work out whether our library membership renewal should move online before the March board meeting, and what we would have to build to make that possible",
  },
  // A terse one. Short enough that the left rule is most of the visual weight,
  // which is where the treatment either still reads as a quote or does not.
  ShortIdea: { seedIdea: "A chore app" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Full-width: it sits inside the handoff card, which spans the whole column.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
