import Component from "../../components/AppHeader";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const SAVED = [
  { id: "m-1", title: "An app to help me brainstorm ideas" },
  { id: "m-2", title: "I want help building an app to plan my trip." },
];

const scenarios: Record<string, Props> = {
  // The first board someone opens: the menu has a new-board action and
  // nothing to go back to.
  Default: { maps: [{ id: "m-1", title: "An app to help me brainstorm ideas" }], currentId: "m-1" },
  // A returning user, where the menu earns its place.
  Returning: { maps: SAVED, currentId: "m-1" },
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
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
