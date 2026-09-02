import Component from "../../../app/components/IntakeHint";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// Both of the only two states this line has. The 930px wrapper is the intake
// column it sits under, which is what decides whether the file-type list fits
// on one line.
const scenarios: Record<string, Props> = {
  // At rest: what can be dropped on the input, stated once and quietly.
  Default: { reading: false },

  // The same line doing double duty while a document is extracted, because the
  // person's attention is already here and a spinner elsewhere would split it.
  Reading: { reading: true },
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
      <div style={{ width: "100%", maxWidth: 930 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
