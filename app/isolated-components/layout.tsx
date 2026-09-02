import { notFound } from "next/navigation";
import { codeyamLaunched } from "../lib/codeyamOnly";

// The gate on the whole component-fixture surface — 104 pages, and the bulk of
// this app's codeyam-only routes.
//
// This used to ask `NODE_ENV === "production"`, which meant every ordinary
// `npm run dev` served all of them. The fixtures render invented maps that look
// exactly like a person's real ones, so a developer looking at their own work
// could wander into a hundred convincing fakes. `codeyamLaunched()` asks the
// question that actually separates the two callers: did codeyam start this
// server. See `app/lib/codeyamOnly.ts` for why that variable and not another.
//
// The escape hatch is that same variable, not a query param: a developer who
// genuinely wants these pages on their own server runs
// `CODEYAM_APP_PORT=1 npm run dev`. There is deliberately no `?isolated=1`
// opt-in — this Next version does not pass `searchParams` to layouts ("Layouts
// do not rerender on navigation, so they cannot access search params"), and this
// layout is the only single place that covers all 104 pages. A prop added here
// would arrive `undefined` and the gate would refuse an opt-in it appeared to
// honour, which is worse than not offering one.
export const metadata = {
  robots: { index: false, follow: false },
};

export default function IsolatedComponentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!codeyamLaunched()) {
    notFound();
  }
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}
