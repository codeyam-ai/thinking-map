import Component from "../../components/IdeaPrompt";
import FetchFailureFixture, {
  type StubbedFailure,
} from "../FetchFailureFixture";

// Each failure body is what the route ACTUALLY answers with, copied from a run
// of `withFailure` rather than composed here — a scenario that invents a body
// the server would never send demonstrates nothing.
const scenarios: Record<string, StubbedFailure | null> = {
  Default: null,

  // The reported case. A 500 with nothing in it is what reached the browser,
  // and reading it as JSON is what put the parser's complaint on screen.
  ServerFailureEmptyBody: { status: 500, body: "" },

  // The same drift once the route is wrapped: a sentence about the app, plus
  // the one command that fixes it.
  SchemaDrift: {
    status: 500,
    body: JSON.stringify({
      error:
        "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
      command: "npm run db:push",
      detail:
        "P2022 · The column `main.MapNode.testsNodeId` does not exist in the current database.",
    }),
  },

  // The same failure in production, where the classifier withholds the command
  // and the column name: the message and nothing else.
  SchemaDriftProduction: {
    status: 500,
    body: JSON.stringify({
      error:
        "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
    }),
  },

  // A failure no route ever saw, so no route could have made it JSON.
  BadGateway: {
    status: 502,
    body: "<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>",
    contentType: "text/html",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (!(s in scenarios)) {
    return <div>Unknown scenario: {s}</div>;
  }
  const failure = scenarios[s];

  const component = (
    <div style={{ width: "100%", maxWidth: 930 }}>
      <Component />
    </div>
  );

  return (
    <div id="codeyam-capture">
      {failure ? (
        <FetchFailureFixture failure={failure}>{component}</FetchFailureFixture>
      ) : (
        component
      )}
    </div>
  );
}
