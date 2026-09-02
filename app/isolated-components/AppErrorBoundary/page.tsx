import ErrorBoundaryFixture from "../ErrorBoundaryFixture";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof ErrorBoundaryFixture>, "boundary">;

// The boundary's two states are the two halves of what React hands it.
//
// Mounted through ErrorBoundaryFixture rather than directly: one of this
// component's props is a function (`reset`), and a server component cannot pass
// a function to a client one. The fixture builds both props on the client.
const scenarios: Record<string, Props> = {
  // Production: React has replaced the message with an opaque digest, which is
  // the whole reason this boundary cannot diagnose anything, and why the pages
  // catch their own load failures on the server instead of leaving it to here.
  WithDigest: {
    message: "An error occurred in the Server Components render.",
    digest: "1174297556",
  },
  // Development, or any failure React assigned no digest to: the card carries
  // no reference line at all rather than an empty space where one goes.
  NoDigest: {
    message: "Cannot read properties of undefined",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "WithDigest" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <ErrorBoundaryFixture boundary="app" {...props} />
    </div>
  );
}
