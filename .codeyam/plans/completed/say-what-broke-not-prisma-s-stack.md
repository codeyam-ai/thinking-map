---
title: "Say What Broke, Not Prisma's Stack"
mode: ui
createdAt: "2026-09-02T12:03:10Z"
source: manual
---

## Summary

Loading a map against a database that is behind `prisma/schema.prisma` throws a raw `PrismaClientKnownRequestError` (P2022, `MapNode.testsNodeId does not exist`) out of `getMap`, and nothing in the app catches it: there is no `error.tsx`, `global-error.tsx` or `not-found.tsx` anywhere under `app/`, so the person gets a 500 and a Prisma stack trace in the browser. `generateMetadata` throws on the same call one frame earlier, so the page fails before the body is even attempted. This plan gives the app a real error surface — an in-voice screen that says what happened, and in development names the one command that fixes it — plus a proper 404 for an unknown map id. (Confirmed drift: `dev.db`'s `MapNode` table has 14 columns and is missing `testsNodeId`, `sourceRef` and `options`; `npm run db:push` is the remediation, and this plan makes the app *say* that instead of the person having to read a stack trace.)

## Key Decisions

- **Catch on the server, not only in the client boundary.** A Next `error.tsx` is a client component, and in production React strips `error.message` down to a digest — so a boundary alone can never render "the database is behind the schema". The two DB-backed pages therefore catch their own load failure and render a diagnosis directly. The client boundary stays as the safety net for everything else.
- **One pure classifier, `classifyLoadError`.** Turning an unknown thrown value into `{ title, message, hint }` is pure logic over a Prisma error code, so it lives in `app/lib/` and is unit-tested, rather than being inlined into two page components. P2022/P2021 (column/table missing) and P1001/P1003 (database unreachable/absent) get named diagnoses; everything else falls through to a generic one.
- **Development names the fix; production stays quiet.** The `npm run db:push` hint and the Prisma code/column are gated on `process.env.NODE_ENV !== 'production'`. A deployed app shows the in-voice message and the digest only — schema internals are not leaked to a visitor.
- **`generateMetadata` never throws.** It already has a "no map" branch returning `{ title: 'Thinking Map' }`; a failed read takes the same branch rather than 500-ing the route from metadata.
- **One `ErrorScreen` component, four callers.** The map page, the home page, `app/error.tsx` and `app/not-found.tsx` all render the same thing, so the treatment cannot drift. Copy follows the design system's Voice section — it names what went wrong and what to do next, and does not apologise.
- **No schema/DB changes here.** The drift itself is fixed by running `npm run db:push`; this plan is about the app behaving well when it happens, not about this one database file.

## Implementation

### 1. Classify a load failure

**New file**: `app/lib/loadError.ts`

`classifyLoadError(error: unknown, opts?: { dev?: boolean }): LoadErrorInfo` returning `{ title, message, hint?, detail? }`.

- Detect a Prisma known-request error structurally (an object with a string `code` and a `clientVersion`) rather than by `instanceof` — the thrown value crosses a server/client boundary and the class is not reliable.
- `P2022` (column not found) and `P2021` (table not found) → title "The database is behind the app", message that the schema has moved on since this database file was created; `hint` (dev only) `Run npm run db:push to bring it up to date.`; `detail` (dev only) the `code` plus the message's column/table text.
- `P1001` / `P1003` → "Can't reach the database", hint pointing at `DATABASE_URL` and `DATABASE.md`.
- Anything else → generic "Something went wrong loading this map" with no internals.
- `dev` defaults to `process.env.NODE_ENV !== 'production'`; taking it as a parameter is what makes the production behaviour testable.

### 2. The shared error surface

**New file**: `app/components/ErrorScreen.tsx`

A server-renderable presentational component taking `{ title, message, hint?, detail?, action? }`. Uses the existing tokens from `app/globals.css` — `--surface` card on `--paper`, `--ink` title, `--ink-soft` body, `--muted` for `detail`, pill shapes throughout — matching `MapEmptyState`'s restraint. `hint` renders as a monospaced pill so the command is copyable-looking; `detail` renders small and muted beneath. `action` is an optional slot for a button/link (used by the client boundary's "Try again" and not-found's "Start a new map").

### 3. The map page stops throwing

**File**: `app/map/[id]/page.tsx`

- Wrap the `getMap(id)` call in `MapPage` so a thrown error becomes `<ErrorScreen {...classifyLoadError(error)} />` rendered inside the same `<main>`/`AppHeader` chrome the workspace uses, instead of propagating. `notFound()` still fires for a genuinely missing map.
- Wrap the `getMap(id)` call in `generateMetadata` so a failure returns `{ title: 'Thinking Map' }` — the existing no-map branch — rather than throwing.
- Log the original error server-side (`console.error`) in both places, so the terminal keeps the full Prisma output the classifier deliberately hides from the page.

### 4. The home page gets the same treatment

**File**: `app/page.tsx`

`listMaps()` hits the same database and fails the same way. Catch it and render `<ErrorScreen>` beneath the existing `AppHeader` instead of `LandingScreen`.

### 5. The client safety net

**New file**: `app/error.tsx`

Client boundary for everything under `app/` that the server-side catches do not cover (render-time failures in `MapScreen`, `WebMcpBridge`, etc.). Renders `ErrorScreen` with a generic message plus the `digest` when present, and a "Try again" button wired to the `reset` prop.

**New file**: `app/global-error.tsx`

The last resort for a failure in the root layout itself. Must render its own `<html>`/`<body>`; keeps the copy minimal and does not import the token-dependent screen chrome beyond what `globals.css` provides.

### 6. A real 404 for an unknown map

**New file**: `app/not-found.tsx`

`MapPage` already calls `notFound()` for an id with no map; today that renders Next's default page. Render `ErrorScreen` instead — "No map with that link", with a link back to `/` to start one. This is also the page a person lands on after deleting a map and using a stale bookmark.

### 7. Tests

**New file**: `app/lib/loadError.test.ts`

Unit tests over `classifyLoadError`: the P2022 shape from this report yields the drift diagnosis and the `db:push` hint; the same input with `dev: false` yields the message with no `hint` and no `detail`; P1001 yields the connection diagnosis; an ordinary `Error` yields the generic one with nothing leaked.

**New file**: `app/components/ErrorScreen.render.test.tsx`

Following the existing `*.render.test.tsx` convention (see `app/components/AgentHandoff.render.test.tsx`): the hint and detail render when passed and are absent when omitted, and the title is the heading.

## Reused existing code

- `getMap` from `app/lib/mapStore.ts` (glossary entry: `getMap`) — the failing call; unchanged, only its call sites gain handling.
- `listMaps` from `app/lib/mapStore.ts` (glossary entry: `listMaps`) — same treatment on the home page.
- `AppHeader` from `app/components/AppHeader.tsx` (glossary entry: `AppHeader`) — the error screen renders inside the same chrome, so a failed load still looks like the app.
- `MapEmptyState` from `app/components/MapEmptyState.tsx` (glossary entry: `MapEmptyState`) — the tone and type scale `ErrorScreen` matches; not reused directly, since an error is a card and not a one-line hint.
- Design tokens in `app/globals.css` (`--paper`, `--surface`, `--ink`, `--ink-soft`, `--muted`, `--line`) and the Voice rules in `.codeyam/design/design_system.md` §7.
- **Existing-implementation survey**: there is no error boundary, error component, or error-classification helper anywhere in the repo today — `find app -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'global-error.tsx'` returns nothing, and no component name matches `*Error*`. Every file in this plan marked `(new)` is genuinely new; the only shared prior art is the `NextResponse.json({ error })` shape in `app/api/maps/route.ts`, which is API-layer and deliberately untouched. `errorResponse` in `app/lib/toolInvocation.ts` is the nearest-named existing helper and is deliberately NOT reused: it marks an MCP tool response as a fault for an agent to reason about, a different audience and a different payload from a rendered page.

## Scenarios to Demonstrate

- **Schema drift, development** — map page against a database missing `MapNode.testsNodeId`: the drift screen with the `npm run db:push` hint and the P2022 detail line.
- **Schema drift, production** — the same failure with `dev: false`: in-voice message, no command, no column name.
- **Database unreachable** — P1001: the connection diagnosis pointing at `DATABASE_URL`.
- **Unknown map id** — `/map/does-not-exist`: the not-found screen with a link back to start a new map.
- **Client render failure** — the `app/error.tsx` boundary with its "Try again" button.
- **Home page load failure** — `listMaps` failing: the same screen under the header, landing screen absent.
- **Happy path unchanged** — a healthy map still renders the workspace, with the `(2) …` open-count title intact.