import Component from "../../components/BulletCard";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { title: "What we know", items: [
    { id: "k1", kind: "known", label: "Vocabulary is the strongest fit for ages 6-8.", detail: null, order: 0 },
    { id: "k2", kind: "known", label: "Three existing apps miss parent involvement.", detail: null, order: 1 },
    { id: "k3", kind: "known", label: "Teachers are a viable second audience.", detail: null, order: 2 },
  ] },
  Empty: { title: "What we don't know", items: [] },
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
      <div style={{ width: "100%", maxWidth: 420 }}><Component {...props} /></div>
    </div>
  );
}
