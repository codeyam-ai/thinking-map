import Component from "../../../app/components/InlineError";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// Every message here is one a real failure actually produces, so the scenarios
// pin the wording as well as the treatment. The 930px wrapper is the intake
// column this line sits under at both of its call sites.
const scenarios: Record<string, Props> = {
  // The reported case, once the page can read it: no route body to quote, so
  // the status is all there is to say beyond the caller's own sentence.
  Default: { message: "Could not start a map. (HTTP 500)" },

  // A route that classified what went wrong gets to say it, and in development
  // to offer the one command that fixes it. Two lines at this width, which is
  // what the wrapping has to hold up under.
  Diagnosis: {
    message:
      "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
    command: "npm run db:push",
    className: "mt-4",
  },

  // The same failure deployed, where the classifier withheld the command. The
  // pill's absence is the whole point of the scenario: compare it to Diagnosis.
  DiagnosisInProduction: {
    message:
      "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
    className: "mt-4",
  },

  // The upload half, where the route stated its own sentence and the fallback
  // was never needed.
  Upload: {
    message:
      "We could not read brief.pdf. It may be protected or damaged — paste the text instead.",
  },

  // Nothing wrong, nothing rendered. The none case is the one every call site
  // is in almost all of the time, and it must not leave a gap in the column.
  Silent: { message: null },
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
