import Component from "../../components/UserBubble";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    content: "Actually, what if this isn't for kids, what if it's for teachers instead?",
  },
  Short: { content: "Vocabulary." },
  Long: {
    content:
      "I keep hearing that small clinics lose track of follow-up care, and I think there's something to build there, but every time I try to describe it I end up describing an EHR.",
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
      <div style={{ width: "100%", maxWidth: 340 }}><Component {...props} /></div>
    </div>
  );
}
