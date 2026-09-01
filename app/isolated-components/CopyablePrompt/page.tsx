import Component from "../../../app/components/CopyablePrompt";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// A block of text whose whole purpose is to end up somewhere else.
//
// The capture shows the resting state — the button says "Copy start prompt",
// not "Copied", because that is what a person actually arrives to. The copied
// state is reachable only by clicking, and the clipboard-refusal path is the
// case worth being deliberate about: the text stays on screen either way, so
// there is always the select-and-copy route underneath.
const scenarios: Record<string, Props> = {
  // The handoff panel's own use: a start prompt naming a real map id.
  Default: {
    text:
      'Work on thinking map cmtixt5tg000wymek3vbmllaj — "A weekend app for splitting chores fairly". Start with read_map, then deconstruct the idea.',
    label: "Copy start prompt",
  },
  // A brief-started map's prompt, which is shorter and names a different first
  // tool — worth seeing that the monospace block reads well at both lengths.
  ShortPrompt: {
    text:
      "Work on thinking map cmtixrnsr000symeky9nw5izd. Start with read_brief to read the brief it was started from, then deconstruct it.",
    label: "Copy start prompt",
  },
  // The generic label, for any future caller that is not the handoff panel.
  DefaultLabel: {
    text: "npm run mcp",
  },
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
