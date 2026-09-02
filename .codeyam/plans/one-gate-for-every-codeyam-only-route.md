---
title: "One Gate for Every CodeYam-Only Route"
mode: ui
createdAt: "2026-09-02T19:39:47Z"
source: manual
dependsOn: ["restore-the-agent-handoff-surface-the-merge-dropped"]
---

## Summary

Three routes exist only to serve codeyam, and all three decide whether to appear by asking `NODE_ENV`. That answers "is this a dev build" when the question that matters is "did anyone actually ask for this" — so in a direct `npm run dev` session a person gets 104 fixture-rendering routes under `/isolated-components/*` showing invented maps, plus a live `POST /api/codeyam-revalidate` that flushes their page cache. It is the same wrong gate the agent panel was moved off in `e3673c1`, still in place on every other codeyam-only surface, and the same wrong gate a merge was able to reintroduce because nothing named the rule in one place. This plan gives the codeyam-only routes one shared predicate that says what they are, and a test that fails when a new one appears without it.

## Key Decisions

- **One predicate, named once.** `agentPanelRequested` already carries this exact reasoning in prose (`app/lib/agentPanel.ts`) but is specific to one query param on one page. The general rule — a route that exists for codeyam is off unless something asked for it — becomes `codeyamOnlyRoute`, so the next such route inherits the decision instead of re-deriving it, and a reviewer has one place to read what the rule is.
- **`/isolated-components/*` stays reachable in dev, and that is deliberate.** It is where every component scenario captures from, and 344 of the 370 registered scenarios load it directly. Turning it off would delete the capture surface. What changes is only how the gate is written — through the shared predicate rather than its own `NODE_ENV` check — plus a `noindex` so a page of invented maps can never surface as if it were the app. The production 404 is unchanged, and nothing visible is added, because the layout is the capture frame.
- **`/api/codeyam-revalidate` gets a token, not just a mode check.** It is the only codeyam-only route that *does* something — `revalidatePath` on caller-supplied paths — and `NODE_ENV !== 'development'` lets anything on the machine, including an agent driving the browser, call it. A shared token read from the environment is the smallest change that makes "the editor asked for this" checkable rather than assumed.
- **The agent panel is not touched here.** `restore-the-agent-handoff-surface-the-merge-dropped` already reconnects `agentPanelRequested` at the map route, and duplicating that would put two plans in the same three lines. This plan depends on it and adds the thing that plan does not: a test at the route level, so the gate cannot be dropped by the next merge the way it was by `e842ce6`.
- **The test asserts the rule, not one route.** Every existing test covers a specific gate in isolation, which is why a route that quietly lost its gate still passed 586 of them. The new test enumerates the codeyam-only routes from the filesystem and asserts each one refuses an unasked-for request — so adding a fourth such route without a gate is a failure rather than a silent regression.

## Implementation

### 1. The shared predicate

**New file**: `app/lib/codeyamOnly.ts`

Export `codeyamOnlyRoute(request?): boolean` — false in production unconditionally (the floor, checked first, exactly as `agentPanelRequested` does it), otherwise true only when the caller presents the codeyam marker: the `CODEYAM_ROUTE_TOKEN` environment variable matched against an `x-codeyam-token` header, or, when no token is configured, development alone. Carry the reasoning from `app/lib/agentPanel.ts`'s docstring here in general form, since this is now where it lives.

Also export the env-var name as a constant (`CODEYAM_ROUTE_TOKEN_ENV`, new), so the route and its tests never spell the string twice.

**File**: `app/lib/agentPanel.ts`

`agentPanelRequested` keeps its query-param behaviour unchanged — it answers a different question (a person typed a URL) than the header check does. Replace only its inline production floor with a call to the shared helper, so there is one place the floor is written.

### 2. The revalidate route

**File**: `app/api/codeyam-revalidate/route.ts`

Replace the `process.env.NODE_ENV !== 'development'` early return with `codeyamOnlyRoute(request)`, keeping the same 404 body so an unauthorised caller cannot tell the route exists. The path-parsing and `revalidatePath` loop below are unchanged.

### 3. The isolated-components shell

**File**: `app/isolated-components/layout.tsx`

Keep `notFound()` for production but route it through `codeyamOnlyRoute()` so the rule is stated once. Add a `metadata` export with `robots: { index: false, follow: false }` — these pages render plausible-looking fixture content at stable URLs and should never be indexed or treated as app pages.

Do not add a visible banner: the layout is the capture frame, and anything it paints lands in 344 scenario screenshots.

### 4. The route-level test

**New file**: `app/lib/codeyamOnly.test.ts`

See the Reproduction Test section below.

## Reused existing code

- `agentPanelRequested` from `app/lib/agentPanel.ts` (glossary entry: `agentPanelRequested`) — the prior art for this exact decision, already covered by `app/lib/agentPanel.test.ts`. Its query-param semantics are unchanged; only its production floor moves to the shared helper.
- `AGENT_PANEL_PARAM` from `app/lib/agentPanel.ts` — the pattern of exporting the magic string beside the predicate rather than repeating it in the route and the test; the new token-name constant follows it.
- `app/api/codeyam-revalidate/route.ts` — the existing handler, whose docstring already states the intent ("404s in production so it never ships live"); this plan makes the code match the stricter thing the intent implies.
- `app/isolated-components/layout.tsx` — the existing production guard, kept and re-expressed rather than replaced.
- `loadEnv` from `app/lib/loadEnv.ts` (glossary entry: `loadEnv`) — how the new token env var reaches the test runner, since `vitest.config.ts` already imports it. No new loading mechanism is needed.

**Existing-implementation survey**: `agentPanelRequested` is the only route-gating predicate in the repo and it is reused rather than duplicated. Nothing today reads a request header for authorisation — grepping app/api for a request-header read returns nothing — so `x-codeyam-token` is genuinely new rather than a second spelling of an existing check. `isWebMcpAvailable` and `webMcpUnavailableReason` in `app/lib/webmcp.ts` are deliberately not reused: they answer whether WebMCP can bind in this frame, which is false in an ordinary tab as well as in a capture, so they cannot distinguish the two callers this plan needs to tell apart.

## Reproduction Test

Pins that a codeyam-only route refuses a request nobody asked it for — the property whose absence leaves fixture pages and a live cache-flush endpoint on every direct `npm run dev` session.

**Target**: `app/lib/codeyamOnly.test.ts` (new) — run with
`codeyam-editor editor refresh-tests --test <name>`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const withEnv = async (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v ?? '');
  vi.resetModules();
  return import('./codeyamOnly');
};

afterEach(() => vi.unstubAllEnvs());

describe('codeyamOnlyRoute', () => {
  // The regression this pins: the gate was NODE_ENV alone, so anything running
  // on the machine during an ordinary `npm run dev` — including an agent
  // driving the browser — could reach a route that exists only for the editor.
  it('refuses a request with no codeyam token when one is configured', async () => {
    const { codeyamOnlyRoute } = await withEnv({
      NODE_ENV: 'development',
      CODEYAM_ROUTE_TOKEN: 'secret',
    });
    expect(codeyamOnlyRoute(new Request('http://localhost/x'))).toBe(false);
  });

  // The editor's own call, which must keep working — a gate that refuses
  // everything would pass the case above and break every capture.
  it('admits a request carrying the configured token', async () => {
    const { codeyamOnlyRoute } = await withEnv({
      NODE_ENV: 'development',
      CODEYAM_ROUTE_TOKEN: 'secret',
    });
    const request = new Request('http://localhost/x', {
      headers: { 'x-codeyam-token': 'secret' },
    });
    expect(codeyamOnlyRoute(request)).toBe(true);
  });

  // The floor, which no token and no header can lift.
  it('refuses in production even with the right token', async () => {
    const { codeyamOnlyRoute } = await withEnv({
      NODE_ENV: 'production',
      CODEYAM_ROUTE_TOKEN: 'secret',
    });
    const request = new Request('http://localhost/x', {
      headers: { 'x-codeyam-token': 'secret' },
    });
    expect(codeyamOnlyRoute(request)).toBe(false);
  });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `app/lib/codeyamOnly.ts` does not exist, so all three cases fail at the dynamic import — "Failed to resolve import ./codeyamOnly". Once the module exists, the first case is the one that carries the regression; the second and third pass trivially against a naive implementation and are there to stop the gate being fixed by refusing everything.

The token-absent fallback (development alone, matching today's behaviour) is deliberately not pinned here — it is the compatibility path for a checkout with no token configured, and asserting it would freeze the weaker behaviour as a requirement.

## Scenarios to Demonstrate

- **An isolated-components page, opened directly** — `/isolated-components/MapScreen?s=Working` in a plain dev session, rendering exactly as it does for a capture. Unchanged on purpose: this is the surface that must keep working.
- **The map page with no panel** — a real map in a direct `npm run dev` session with no `?agentPanel=1`, carrying no agent panel and no other dev affordance. What a person running the app themselves should see.
- **The map page opted in** — the same map at `?agentPanel=1`, launcher back in its corner, showing the gate admits a deliberate request.
- **A revalidate call with no token** — the 404 body, identical to the response for a route that does not exist.
- **A revalidate call from the editor** — the `{ revalidated: [...] }` reply, proving the capture path is intact.