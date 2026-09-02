import Component from "../../components/AskPresenceNote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The two things this line can say, side by side — because the difference
// between them is the feature's one honest claim. WebMCP is pull-only, so a
// question reaches an agent already waiting and reaches nobody otherwise, and
// the copy has to draw that line rather than blur it.
const scenarios: Record<string, Props> = {
  // Someone is there: asking wakes them, which is the whole reason this is
  // different from leaving a note.
  Listening: { listening: true },
  // The state every preview and capture genuinely produces, and the one worth
  // getting right: absence is stated plainly instead of implying a reply.
  NoAgent: { listening: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Listening" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Bounded to the composer's own width, which is where this line actually
  // lives — the wrapping is part of what makes it readable or not.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 266 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
