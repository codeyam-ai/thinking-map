import Component from "../../components/PhaseNav";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

type Scenario = { props: Props; width?: number };

const scenarios: Record<string, Scenario> = {
  Default: { props: { active: "idea" } },
  Research: { props: { active: "research" } },
  NextSteps: { props: { active: "next-steps" } },
  // The whole track fits at Tablet, so none of the scenarios above can show the
  // fade doing its job — after the fix they carry no mask at all. Squeezing the
  // track to 240px with a middle phase active cuts content off on both sides,
  // which is the one state where both fades are the correct answer.
  // Parked at the start of an overflowing track: the trailing fade is the only
  // one, which is the old unconditional behaviour now shown where it is earned.
  NarrowAtStart: { props: { active: "idea" }, width: 240 },
  NarrowScrolled: { props: { active: "research" }, width: 240 },
  // The mirror of the reported bug: scrolled hard against the end, the trailing
  // fade is gone and the leading one is what says the earlier phases are still
  // back there. Without this the left-edge fade ships with nothing showing it.
  NarrowAtEnd: { props: { active: "next-steps" }, width: 240 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const scenario = scenarios[s];
  if (!scenario) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div
      id="codeyam-capture"
      style={scenario.width ? { width: scenario.width } : undefined}
    >
      <Component {...scenario.props} />
    </div>
  );
}
