import Component from "../../../app/not-found";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// This page takes no props — it is the fixed 404 surface — so there is one
// scenario and it is the whole component. What the capture is worth showing is
// that a missing map still arrives inside the app's own chrome, header and all,
// rather than on Next's stock error page.
const scenarios: Record<string, Props> = {
  Default: {},
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
  // Full-width surface: #codeyam-capture fills the layout-centered viewport.
  // Bounded card? Wrap to match the component's real container width:
  //   <div id="codeyam-capture">
  //     <div style={{ width: "100%", maxWidth: 384 }}>
  //       <Component {...props} />
  //     </div>
  //   </div>
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
