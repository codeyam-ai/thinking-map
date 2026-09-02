import Component from "../../components/Disclosure";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  // Closed is the state that matters: it is how both folds sit under the map,
  // and the whole point is that they take one line until you want them.
  Default: {
    summary: "Add something of your own",
    children: "Somewhere to volunteer something nobody asked for.",
  },
  // The rail's fold carries a count, so the label has to stay legible with a
  // number appended rather than assuming a bare phrase.
  WithCount: {
    summary: "Activity · 16",
    children: "The record of what the two sides have done to the map.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
