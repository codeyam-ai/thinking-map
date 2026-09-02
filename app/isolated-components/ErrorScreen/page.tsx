import Component from "../../components/ErrorScreen";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// Every state here is a real `classifyLoadError` output, not hand-written copy.
// The screen has no route of its own — it renders inside whichever page failed
// — so this is where its states are actually visible.
const scenarios: Record<string, Props> = {
  // The reported failure, in development: the app names the fix.
  SchemaDrift: {
    title: "The database is behind the app",
    message:
      "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
    command: "npm run db:push",
    detail: "P2022 · main.MapNode.testsNodeId",
  },
  // The same failure deployed. A visitor gets the diagnosis and nothing else:
  // the command is useless to them and the column name is ours, not theirs.
  SchemaDriftProduction: {
    title: "The database is behind the app",
    message:
      "The schema has moved on since this database was created, so the map cannot be read. Nothing is lost — the database just needs to catch up.",
  },
  Unreachable: {
    title: "Can't reach the database",
    message:
      "The app is running but nothing answered at the database it was pointed at.",
    hint: "Check DATABASE_URL in .env — DATABASE.md covers the setup.",
    detail: "P1001 · Can't reach database server",
  },
  // The only state carrying an `action`. It is also the only one where there is
  // a genuine next move — the others are settings problems the visitor cannot
  // fix from the page, and a button offering nothing would be worse than none.
  NotFound: {
    title: "No map with that link",
    message:
      "Either it was never here or it has since been deleted. Whatever you were thinking about is still worth mapping.",
    action: (
      <a
        href="/"
        suppressHydrationWarning
        className="inline-block rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition-opacity hover:opacity-90"
      >
        Start a new map
      </a>
    ),
  },
  // The fallback: an error we did not recognise leaks nothing but its first line.
  Unrecognised: {
    title: "Something went wrong loading this map",
    message:
      "The map is still there. Reloading is worth a try, and the terminal running the app has the details.",
    detail: "Unexpected end of JSON input",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "SchemaDrift" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
