// Seeds ONE disposable thinking map for the browser eval run, and prints its id.
//
// ---------------------------------------------------------------------------
// Why this is not `prisma/seed.ts`
// ---------------------------------------------------------------------------
//
// `prisma/seed.ts` fills a database a person is going to look at. This fills a
// database a single eval run is going to write to and then throw away. The two
// have opposite requirements: the demo seed should be stable and recognisable,
// while this one has to be *precisely* shaped, because the assertion the eval
// makes is about a count of open questions.
//
// The shape that matters is `formatStandingWait` in `app/lib/mcpFormat.ts`: it
// counts nodes whose `kind` is `open-question` and whose `status` is not
// `answered`, and returns an EMPTY string when that count is zero. A fixture
// that seeds any other kind of node produces no standing-wait sentence at all,
// and the eval then passes or fails for reasons that have nothing to do with
// the behaviour under test. So the open questions below are the fixture; the
// theme and the seed idea are only there to make the map read like a real one.
//
// ---------------------------------------------------------------------------
// It writes wherever DATABASE_URL points — deliberately
// ---------------------------------------------------------------------------
//
// There is no default and no guess. The caller (`scripts/run-browser-evals.ts`)
// points `DATABASE_URL` at a throwaway schema it created and drops afterwards.
// Running this by hand against your development database would leave a stray
// map behind, which is why the runner exists and why this script does not try
// to pick a database for you.
//
// Run with: DATABASE_URL=... npx tsx scripts/seed-eval-map.ts
//
// IMPORTANT: this must use the same adapter pattern as `app/lib/prisma.ts` and
// `prisma/seed.ts`. Do NOT use `new PrismaClient()` without the adapter —
// Prisma 7 requires it. The `loadEnv` import must come before any env read.

import '../app/lib/loadEnv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseConnection } from '../app/lib/databaseUrl';
import { hueForIndex } from '../app/lib/themeHue';
import { evalMapEvents, evalMapFixture } from '../app/lib/evalMapFixture';

const { connectionString, schema } = databaseConnection();
const adapter = new PrismaPg(
  { connectionString },
  schema ? { schema } : undefined,
);
const prisma = new PrismaClient({ adapter });

/**
 * Build the map, its theme, its nodes and the matching event log.
 *
 * The event log is written rather than skipped because `revision` is a real
 * cursor: `recordEvents` numbers each new event `map.revision + 1`, so a map
 * whose `revision` did not agree with its log would hand the agent a cursor
 * that skips or repeats history the moment it called `read_map` with one.
 * Every seeded node therefore gets the `node.added` event it would have had if
 * an agent had put it there.
 */
async function main(): Promise<{ id: string; openQuestions: number }> {
  const fixture = evalMapFixture();

  const map = await prisma.thinkingMap.create({
    data: {
      title: fixture.title,
      seedIdea: fixture.seedIdea,
      phase: fixture.phase,
    },
  });

  const theme = await prisma.theme.create({
    data: {
      mapId: map.id,
      label: fixture.theme.label,
      // The app assigns theme colour, never the caller — see `themeHue.ts`.
      hue: hueForIndex(fixture.theme.order),
      order: fixture.theme.order,
    },
  });

  const idea = await prisma.mapNode.create({
    data: { mapId: map.id, ...fixture.idea, order: 0 },
  });

  const questionNodes = [];
  for (const [index, question] of fixture.questions.entries()) {
    questionNodes.push(
      await prisma.mapNode.create({
        data: {
          mapId: map.id,
          parentId: idea.id,
          themeId: theme.id,
          ...question,
          order: index,
        },
      }),
    );
  }

  // Numbering lives in `evalMapEvents`, which is tested; this only writes what
  // it returns. The map's own `revision` column is the authority
  // `recordEvents` reads, so the two are set from the same list.
  const events = evalMapEvents(theme.label, idea, questionNodes);

  for (const event of events) {
    await prisma.mapEvent.create({
      data: {
        mapId: map.id,
        revision: event.revision,
        kind: event.kind,
        origin: event.origin,
        payload: JSON.stringify(event.payload),
      },
    });
  }

  await prisma.thinkingMap.update({
    where: { id: map.id },
    data: { revision: events.length },
  });

  return { id: map.id, openQuestions: fixture.questions.length };
}

main()
  .then(async ({ id, openQuestions }) => {
    await prisma.$disconnect();
    // The id goes to stdout ALONE so the runner can capture it with `$(...)`;
    // everything a human wants to read goes to stderr. A single stray
    // `console.log` here would be captured as part of the id and produce a URL
    // that 404s, which is a confusing way to learn about a logging change.
    console.error(`Seeded eval map ${id} with ${openQuestions} open questions.`);
    console.log(id);
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    console.error(e);
    process.exit(1);
  });
