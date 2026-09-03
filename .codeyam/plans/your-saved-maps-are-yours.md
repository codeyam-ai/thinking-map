---
title: "Your Saved Maps Are Yours"
mode: ui
createdAt: "2026-09-03T00:59:00Z"
source: manual
dependsOn: ["ship-on-vercel-with-hosted-postgres"]
---

## Summary

`listMaps` takes no arguments and filters on nothing, so the "Pick up where you left
off" strip on the landing page shows every map anyone has ever made — to everyone.
`GET /api/maps` returns the same unfiltered list to any caller. On a laptop with one
person and one database that is invisible; on a public URL it means the first thing a
visitor sees is a stranger's half-finished thinking, and it reads as a broken app rather
than as a shared canvas. Give each browser an opaque visitor id in an httpOnly cookie,
stamp it on the maps that browser creates, and filter both the strip and the API by it.
No accounts, no login screen, no wall between arriving and typing the first card.

## Key Decisions

- **Scope the list, not the map.** `/map/<id>` stays reachable by anyone holding the
  link, and the tools under `/api/maps/[id]/tools` stay callable. That is load-bearing
  rather than an oversight: the whole product is a page an agent reaches through its own
  tools, and the ids are cuids, so link-holding is already the access model. What is
  being fixed is enumeration — the list that hands out every id for free.

- **A cookie and a column, not `localStorage`.** `app/page.tsx` is a server component
  with `dynamic = 'force-dynamic'` that awaits `listMaps()` before rendering; a
  browser-held list of ids would force that strip to become client-rendered and would
  still leave `GET /api/maps` returning everything. A cookie is readable where the query
  already happens.

- **The cookie is minted in `POST /api/maps` and nowhere else.** In Next 16 a cookie can
  only be written from a route handler or server action, not from a server component —
  and map creation is the only moment a browser earns something to remember. A visitor
  who has never created a map has no cookie, sees no strip, and that is exactly the
  day-one state the landing page is designed around.

- **Existing rows keep `visitorId = null` and belong to nobody.** No backfill, no
  "claim orphans on first visit" — the production database starts empty by design, so
  the only rows this could strand are local development ones.

- **`visitorId` is opaque and identifies a browser, not a person.** It is not an account,
  carries no profile, and nothing else in the app may read it as identity. Clearing
  cookies loses the strip and loses nothing else, since every map is still at its own URL.

## Implementation

### 1. Add the owner column

**File**: `prisma/schema.prisma`

Add `visitorId String?` to `ThinkingMap` with an `@@index([visitorId])`, and a doc
comment in the style of the surrounding fields explaining that it names the browser that
created the map, that it is nullable because maps predating it belong to nobody, and
that it scopes the *list* rather than access to any map.

### 2. Mint and read the visitor id

**New file**: `app/lib/visitor.ts`

Two small functions and one constant: the cookie name, a reader that returns the current
visitor id or `null`, and a minter that generates a fresh opaque id. Cookie attributes:
`httpOnly`, `sameSite: 'lax'`, `secure` in production, a long `maxAge`, and `path: '/'`.

Keep the id generation and the cookie attributes here rather than inline at the call
site, so the pure half is testable in milliseconds and there is one place that decides
what the cookie looks like.

### 3. Filter the store

**File**: `app/lib/mapStore.ts`

`listMaps` takes a `visitorId: string | null` and returns `[]` for `null` rather than
everything — the failure mode of the opposite default is precisely the bug being fixed,
so absence must mean nothing, not all. `createMap` takes the visitor id alongside its
existing arguments and writes it into the `prisma.thinkingMap.create` data. Neither
function's other behaviour changes.

### 4. Set the cookie where the map is made

**File**: `app/api/maps/route.ts`

`POST`: read the visitor id, mint one when absent, pass it to `createMap`, and attach the
`Set-Cookie` to the 201 response. The existing "a brief is enough on its own" validation
runs first and unchanged — a rejected request must not mint anything.

`GET`: pass the cookie's visitor id to `listMaps`, so this door returns the same scoped
list the page renders. Both handlers stay wrapped in `withFailure`.

### 5. Render only the visitor's maps

**File**: `app/page.tsx`

Read the cookie and pass it to `listMaps`. Everything else holds: the `try`/`catch`
around the call, the `ErrorScreen` fallback through `classifyLoadError`, and the
`maps.length > 0` guard that already renders the strip only for returning visitors —
which now means what it says.

## Reused existing code

- `listMaps` and `createMap` from `app/lib/mapStore.ts` (glossary entries: `listMaps`,
  `createMap`) — both gain a parameter; no new query path is introduced.
- `SavedMapList` from `app/components/SavedMapList.tsx` (glossary entry: `SavedMapList`)
  and `SavedMapRow` from `app/components/SavedMapRow.tsx` (glossary entry: `SavedMapRow`)
  — unchanged. They already render nothing for an empty list, which is the new default.
- `withFailure` from `app/lib/apiFailure.ts` (glossary entry: `withFailure`) — both
  handlers in `app/api/maps/route.ts` keep their existing wrapper.
- `classifyLoadError` from `app/lib/loadError.ts` (glossary entry: `classifyLoadError`)
  — the landing page's error path is untouched.
- `cuid` via Prisma's `@default(cuid())` — the same id shape the schema already uses for
  every primary key, so nothing new is introduced for the visitor id's generation.
- **Existing-implementation survey:** there is no existing notion of a viewer, session,
  owner, or account anywhere in the schema or in `app/lib` — no `User` model, no
  `next/headers` import in the entire `app/` tree, and no middleware file. `visitorId` is
  genuinely new rather than a duplicate of something already present. Node authorship is
  tracked per node (the *yours* badge) and is about which side of the exchange wrote a
  node, not about which browser owns a map; the two must not be conflated.

## Reproduction Test

Pins the bug that `listMaps` returns maps belonging to other visitors.

**Target**: `app/lib/contributions.integration.test.ts` — run with
`codeyam-editor editor refresh-tests --test listMapsScopesToVisitor`. This file already
stands up a real database and exercises `mapStore` against it, which is what a query
filter needs; `app/lib/mapStore.test.ts` is deliberately the database-free half and is
the wrong home.

```ts
// Two browsers, two maps: the list a visitor gets back must contain only their
// own. Returning everything is the enumeration bug this pins.
it('returns only the maps belonging to the given visitor', async () => {
  await mapStore.createMap('theirs', undefined, [], 'visitor-b');
  const mine = await mapStore.createMap('mine', undefined, [], 'visitor-a');

  const listed = await mapStore.listMaps('visitor-a');

  expect(listed.map((m) => m.id)).toEqual([mine.id]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `createMap` and
`listMaps` do not yet accept a visitor argument, so this fails to type-check, and once
the arguments exist but the `where` clause does not, the assertion fails with both map
ids returned instead of one.

Note that the exact `createMap` argument position must be checked against the signature
at execution — it currently reads `(seedIdea, brief?, attachments = [])`, and the test
above assumes the visitor id is appended after those.

## Scenarios to Demonstrate

- First arrival, no cookie — one card, no saved-map strip. The day-one state a judge
  lands on.
- A returning visitor with three maps — the strip renders their maps and only theirs.
- Two visitors, one database — the second browser's landing page shows nothing while the
  first browser's shows its three, which is the whole fix made visible.
- A returning visitor with more than three maps, so the "Show all" affordance is still
  exercised under the filter.
- A map opened by link with no cookie — the map renders fully and its tools work, proving
  the scoping stopped at the list and did not become an access wall.