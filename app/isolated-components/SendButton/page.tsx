import Component from "../../components/SendButton";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { disabled: false, label: "Send" },
  Disabled: { disabled: true, label: "Send" },
  Large: { disabled: false, label: "Start thinking this through", size: "large" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The button positions itself inside an input pill, so the isolation host
  // reproduces that pill rather than showing it floating.
  const tall = props.size === "large";
  return (
    <div id="codeyam-capture">
      <div
        className="relative rounded-full border-[1.5px] border-ink bg-surface"
        style={{ width: "100%", maxWidth: tall ? 640 : 380, height: tall ? 76 : 54 }}
      >
        <Component {...props} />
      </div>
    </div>
  );
}
