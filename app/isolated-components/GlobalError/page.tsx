import ErrorBoundaryFixture from "../ErrorBoundaryFixture";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof ErrorBoundaryFixture>, "boundary">;

// The root-layout failure, which is the one state a person should almost never
// see. Shown with a digest, because that is what a deployed failure of this
// severity actually carries and it is the only thing on the card quotable into
// a bug report.
//
// Mounted through ErrorBoundaryFixture for the same reason as AppErrorBoundary:
// `reset` is a function, and a server component cannot hand one to a client
// component.
//
// A caveat the capture cannot show: this component supplies its own <html> and
// <body>, so nesting it in this page is not the document it produces in
// production. The copy and the card are what the scenario is for.
const scenarios: Record<string, Props> = {
  Default: {
    message: "Root layout failed to render",
    digest: "2847193044",
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
  return (
    <div id="codeyam-capture">
      <ErrorBoundaryFixture boundary="global" {...props} />
    </div>
  );
}
