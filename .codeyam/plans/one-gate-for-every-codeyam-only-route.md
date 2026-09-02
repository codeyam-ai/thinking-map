---
title: "One Gate for Every CodeYam-Only Route"
mode: ui
createdAt: "2026-09-02T19:39:47Z"
source: manual
dependsOn: ["restore-the-agent-handoff-surface-the-merge-dropped"]
---

## Summary

Two routes exist only to serve codeyam, and both decide whether to appear by asking `NODE_ENV`. That answers "is this a dev build" when the question that matters is "did codeyam launch this server" — so in a direct `npm run dev` session a person gets 344 fixture-rendering routes under `/isolated-components/*` showing invented maps that look exactly like real ones. It is the same wrong gate the agent panel was moved off in `e3673c1`, still in place on the rest of the codeyam-only surface, and the same wrong gate a merge was able to reintroduce because nothing named the rule in one place or tested for it. The editor already publishes the fact these routes need: it injects `CODEYAM_APP_PORT` into every dev server it launches, and a server a person started by hand has no such variable. This plan turns that into one shared predicate, applies it where it is safe to apply, and adds the test that fails when a new codeyam-only route appears without it.

## Key Decisions

- **`CODEYAM_APP_PORT` is the discriminator, and it already exists.** `build_env_for_proxied_dev_server` inserts it unconditionally on every editor-launched dev server (in the separate codeyam-editor repo, at crates/process-manager/src/env_builder.rs:410 — external to this tree), alongside `CODEYAM_PROXY_URL` and `CODEYAM_PROJECT_DIR`. A hand-started `npm run dev` has none of them — confirmed by reading the environment of the running server on this machine. So the app can already tell the two callers apart with no editor change, no new configuration, and nothing for a person to remember to set.
- **A request token was considered and rejected.** It would need the editor to send a header it does not send: `request_revalidation` posts `content-type` and a `{}` body and nothing else (codeyam-editor repo, crates/control-api/src/capture_revalidate.rs — external to this tree). Worse, that caller treats 404 as `RouteNotMounted` and *proceeds with the capture anyway* — so a route that started refusing untokened calls would silently produce screenshots of the previous scenario's cached HTML. A gate whose failure mode is silent wrong output is worse than the exposure it closes.
- **`/api/codeyam-revalidate` is deliberately left on its current gate.** For the reason directly above: it is the one codeyam-only route whose refusal corrupts captures instead of merely hiding a page, and what it does when reached — `revalidatePath` on caller-supplied paths in a dev process — is a cache flush, not an exposure worth that risk. This is a decision to record, not an omission; the route's docstring should say so, so the next reader does not "fix" it.
- **`/isolated-components/*` is where the gate pays.** 344 of the 370 registered scenarios capture from it, and all of them run on an editor-launched server, so keying on `CODEYAM_APP_PORT` costs no capture. What it removes is 344 URLs serving plausible-looking fake maps in a session where a person is trying to look at their own work.
- **An escape hatch, matching the one the panel already has.** A developer who genuinely wants to open a component fixture on their own server appends `?isolated=1`, exactly as `?agentPanel=1` summons the panel. Same gesture, same reason: something no agent stumbles onto, needing no restart. Without it the gate would take a real tool away from the person it is meant to protect.
- **The database hazard is not here, because it does not exist.** `.codeyam/seed-adapter.ts`'s "wipes all tables" is real, but the editor sandboxes it: the codeyam-editor repo's crates/control-api/src/db_sandbox (external to this tree) derives a capture database, injects it last so it overrides any pin, and — for a file-shaped stack like this one — fingerprints and restores the production file if an adapter writes it anyway. `seed-adapter-doctor` confirms this project is on that path, serving `file:.codeyam/tmp/db-sandbox/capture.db`. Nothing about `dev.db` belongs in this plan.

## Implementation

### 1. The shared predicate

**New file**: `app/lib/codeyamOnly.ts`

Export `codeyamLaunched(): boolean` — false in production unconditionally (the floor, checked first, as `agentPanelRequested` does it), otherwise true only when `CODEYAM_APP_PORT` is present and non-empty in the environment. Export `CODEYAM_LAUNCH_ENV` as the variable name so the predicate and its tests never spell it twice.

Record in the docstring why this variable and not another: it is injected by the editor's own launch path rather than declared by this project, so it cannot drift out of sync with what the editor actually does, and it is absent by construction on a server a person started themselves. Name the codeyam-editor source file it comes from, since that is the thing this contract depends on.

An empty string counts as absent, following the reasoning already written into the editor's env_builder for CODEYAM_EDITOR_PORT: a config that reads `X || fallback` treats `""` as missing, so treating it as present here would disagree with the producer.

**File**: `app/lib/agentPanel.ts`

`agentPanelRequested` keeps its query-param behaviour unchanged — it answers a different question (a person typed a URL) than the launch check does. Replace only its inline production floor with the shared helper, so the floor is written once.

### 2. The isolated-components shell

**File**: `app/isolated-components/layout.tsx`

Replace the bare `process.env.NODE_ENV === "production"` check with: render when `codeyamLaunched()`, or when the request carries the `?isolated=1` opt-in; otherwise `notFound()`. The layout gains a searchParams prop for the opt-in, `Promise`-typed as this Next version requires.

Add a `metadata` export with `robots: { index: false, follow: false }`. Do not add anything visible — this layout is the capture frame, and whatever it paints lands in 344 scenario screenshots.

### 3. Say why the revalidate route is different

**File**: `app/api/codeyam-revalidate/route.ts`

No behaviour change. Extend the existing docstring to record that this route deliberately does *not* use `codeyamLaunched()`, and why: the editor's caller reads 404 as "route not mounted" and continues the capture, so a stricter gate here trades a harmless cache-flush endpoint for silently stale screenshots.

### 4. The route-level test

**New file**: `app/lib/codeyamOnly.test.ts`

See the Reproduction Test section below.

## Reused existing code

- `agentPanelRequested` from `app/lib/agentPanel.ts` (glossary entry: `agentPanelRequested`) — the prior art for this exact decision, already covered by `app/lib/agentPanel.test.ts`. Its query-param semantics are unchanged; only its production floor moves to the shared helper.
- `AGENT_PANEL_PARAM` from `app/lib/agentPanel.ts` — the pattern of exporting the magic string beside the predicate rather than repeating it in the route and the test; the new launch-variable constant follows it, and the `?isolated=1` param is read the same way (`=1` exactly, first entry of a repeated param).
- `QueryParams` from `app/lib/agentPanel.ts` — the already-defined shape of Next's parsed query; the layout's new searchParams prop uses it rather than redeclaring the type.
- `app/isolated-components/layout.tsx` — the existing production guard, kept as the floor and re-expressed through the shared predicate.
- `app/api/codeyam-revalidate/route.ts` — unchanged behaviour; only its docstring grows the reason it is exempt.

**Existing-implementation survey**: `agentPanelRequested` is the only route-gating predicate in this repo and it is reused rather than duplicated. Nothing here reads a process-level codeyam marker today — grepping the app for a CODEYAM-prefixed env read returns nothing — so `codeyamLaunched` is genuinely new *in this repo*, while the variable it reads is long-standing on the producing side. On that side the survey found the opposite of new: the editor already injects `CODEYAM_APP_PORT`, `CODEYAM_PROXY_URL`, `CODEYAM_PROJECT_DIR` and `CODEYAM_EDITOR_PORT`, and already owns capture-database isolation in its own db_sandbox module — which is why this plan reads an existing signal instead of adding configuration, and why it carries no database changes at all. `isWebMcpAvailable` and `webMcpUnavailableReason` in `app/lib/webmcp.ts` are deliberately not reused: they answer whether WebMCP can bind in this frame, which is false in an ordinary tab as well as in a capture, so they cannot tell these two callers apart.

## Reproduction Test

Pins that a codeyam-only route refuses a server codeyam did not launch — the property whose absence leaves 344 pages of invented maps reachable in a person's own dev session.

**Target**: `app/lib/codeyamOnly.test.ts` (new) — run with
`codeyam-editor editor refresh-tests --test <name>`.

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const load = async (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v ?? '');
  vi.resetModules();
  return import('./codeyamOnly');
};

afterEach(() => vi.unstubAllEnvs());

describe('codeyamLaunched', () => {
  // The regression this pins: the gate was NODE_ENV alone, so every ordinary
  // `npm run dev` served the whole fixture surface — 344 URLs rendering maps
  // that look exactly like a person's real ones.
  it('is false on a dev server a person started by hand', async () => {
    const { codeyamLaunched } = await load({
      NODE_ENV: 'development',
      CODEYAM_APP_PORT: undefined,
    });
    expect(codeyamLaunched()).toBe(false);
  });

  // The editor's own server, which must keep working — a gate that refuses
  // everything would pass the case above and break all 344 captures.
  it('is true on a server the editor launched', async () => {
    const { codeyamLaunched } = await load({
      NODE_ENV: 'development',
      CODEYAM_APP_PORT: '3001',
    });
    expect(codeyamLaunched()).toBe(true);
  });

  // The floor, which no environment variable can lift.
  it('is false in production however the server was launched', async () => {
    const { codeyamLaunched } = await load({
      NODE_ENV: 'production',
      CODEYAM_APP_PORT: '3001',
    });
    expect(codeyamLaunched()).toBe(false);
  });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `app/lib/codeyamOnly.ts` does not exist, so all three cases fail at the dynamic import — "Failed to resolve import ./codeyamOnly". Once the module exists, the first case is the one carrying the regression; the second and third pass against a naive implementation and are there to stop the gate being "fixed" by refusing everything.

Note for execution: `vi.stubEnv` with `undefined` sets an empty string rather than deleting the key, which is why the predicate must treat `""` as absent. If that proves not to hold in this vitest version, delete the key directly rather than weakening the assertion.

## Scenarios to Demonstrate

- **An isolated-components URL on a hand-started server** — `/isolated-components/MapScreen?s=Working` in a direct `npm run dev` session, returning the app's 404. The change this plan is for.
- **The same URL under capture** — rendering exactly as it does today on an editor-launched server, proving all 344 captures are unaffected.
- **The developer escape hatch** — `/isolated-components/MapScreen?s=Working&isolated=1` on a hand-started server, rendering the fixture for someone who deliberately asked.
- **The map page with no panel** — a real map in a direct dev session with no `?agentPanel=1`: no agent panel, no other dev affordance.
- **The map page opted in** — the same map at `?agentPanel=1`, launcher back in its corner.
- **A revalidate call, unchanged** — the `{ revalidated: [...] }` reply, showing the deliberately-exempt route still answers the editor.
