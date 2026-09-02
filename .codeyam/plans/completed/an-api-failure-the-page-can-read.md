---
title: "An API Failure the Page Can Read"
mode: ui
createdAt: "2026-09-02T12:20:37Z"
source: manual
dependsOn: ["say-what-broke-not-prisma-s-stack"]
---

## Summary

Starting a map against a database that is behind `prisma/schema.prisma` throws P2022 (`MapNode.testsNodeId does not exist`) out of `createMap`, and `POST /api/maps` has no catch around it. Next turns the escaped throw into a 500 with a body the browser cannot parse, and `IdeaPrompt` calls `response.json()` *before* checking `response.ok` — so the only thing the person sees is `Failed to execute 'json' on 'Response': Unexpected end of JSON input`, a message about the fetch API rather than about their app. The real fault is in the terminal and nowhere else. This plan makes every mutating API route answer with a JSON error body when something unexpected throws, and makes every client fetch site read a response that is *not* JSON without exploding — so a failed request produces a sentence about what broke instead of a parser error. (Confirmed drift: `dev.db`'s `MapNode` has 14 columns and is missing `testsNodeId`, `sourceRef` and `options`; `MapBrief` exists but is likewise behind. `npm run db:push` is the remediation — this plan changes no schema and no data, it makes the app *say* it.)

## Key Decisions

- **The route is where the JSON contract is kept.** A client that has to survive a non-JSON body is a workaround; a route that always answers in JSON is the fix. Both are needed — the browser can also receive a proxy 502 or a network-level failure no route ever saw — but the route wrapper is the primary change and the client helper is the belt.
- **One wrapper, `withFailure`, not a try/catch in eight handlers.** Every route under `app/api/` already returns `NextResponse.json({ error }, { status })` for the faults it anticipates. `withFailure` extends that same shape to the ones it does not, so a 500 is indistinguishable in form from a 400 and every client can read both the same way.
- **Reuse `classifyLoadError` rather than inventing a second classifier.** The queued plan `say-what-broke-not-prisma-s-stack` introduces `classifyLoadError` in `app/lib/loadError.ts` for the *page render* path; the API path wants exactly the same P2022 → "the database is behind the app" diagnosis, with the same dev/production gating. Two classifiers would drift, and the second one would be the one nobody updated. This plan therefore declares `dependsOn` on that plan — it is not merged into it because that plan is about server-rendered pages having an error surface, while this one is about the fetch/JSON contract between the browser and the API, a different surface with a different failure mode.
- **`response.ok` is checked before the body is read, everywhere.** `forward` in `app/lib/webmcp.ts` already does this correctly (`res.text().catch()` on a non-ok response) and is the pattern the rest should match. `IdeaPrompt` does it backwards in both of its fetches, which is why this specific error reached the screen.
- **No schema and no database changes.** The drift is fixed by running `npm run db:push`. This plan is about the app's behaviour when a database is behind — which will happen again on every teammate's checkout and every deploy that ships a migration late.
- **`postUserEvent` stays fire-and-forget.** It deliberately ignores its response today (`app/lib/webmcp.ts`); a failed user-event post is not worth interrupting an agent's turn over. It gains no handling, and that is recorded here so the omission reads as intentional.

## Implementation

### 1. A failure wrapper for route handlers

**New file**: `app/lib/apiFailure.ts`

`withFailure(handler)` wraps a Next route handler of any arity, awaits it, and on a thrown value:

- `console.error`s the original error, so the terminal keeps the full Prisma output.
- Runs it through `classifyLoadError` (from `app/lib/loadError.ts`, introduced by the plan this one depends on) and returns `NextResponse.json({ error, hint?, detail? }, { status: 500 })`, where `error` is the classifier's `message`, and `hint`/`detail` are present only in development exactly as the classifier already gates them.
- Preserves the handler's own returned response untouched — it only intervenes on a throw.

Typed so it composes with both `(request)` and `(request, { params })` handlers without the call sites casting.

### 2. Wrap the mutating routes

**File**: `app/api/maps/route.ts`

Export `POST` (and `GET`, which calls `listMaps` and fails identically) through `withFailure`. This is the route in the report.

**File**: `app/api/maps/[id]/exchange/route.ts`

**File**: `app/api/maps/[id]/positions/route.ts`

**File**: `app/api/maps/[id]/tools/route.ts`

**File**: `app/api/maps/[id]/route.ts`

**File**: `app/api/briefs/extract/route.ts`

Same treatment. Each already handles its anticipated faults; the wrapper only covers the unanticipated throw. `app/api/mcp/route.ts` is deliberately excluded — it speaks the MCP wire protocol, where a bare `{ error }` JSON body is not a valid response; it needs its own transport-correct handling and is out of scope here.

### 3. A client-side reader that tolerates a non-JSON body

**New file**: `app/lib/readJson.ts`

`readJson<T>(response: Response, fallback: string): Promise<{ ok: boolean; data: T | null; error: string | null }>` — reads the body as text once, attempts `JSON.parse`, and:

- On a parseable body with `response.ok`, returns the data.
- On a parseable body without `response.ok`, returns its `error` field as the message.
- On an unparseable body, returns `${fallback} (HTTP ${response.status})` — never the `SyntaxError` from `JSON.parse`, which is the message that reached the screen in this report.
- On an empty body with a non-ok status, the same.

Pure over a `Response`, so it is unit-testable with a constructed `Response` and no network.

### 4. `IdeaPrompt` reads its two responses safely

**File**: `app/components/IdeaPrompt.tsx`

Both fetches currently call `await response.json()` before testing `response.ok`. Route both through `readJson`:

- `upload` → fallback `'Could not read that file.'`
- `submit` → fallback `'Could not start a map.'`

The existing `setError` / `setBriefError` display is unchanged; only the message reaching it changes. `setBusy(false)` on the failure path stays as it is.

### 5. `WebMcpBridge` reads its contribution reply safely

**File**: `app/components/WebMcpBridge.tsx`

`contribute` already checks `res.ok` first, so it cannot produce the reported error — but its `await res.json()` on a 200 with a truncated body would still throw a raw `SyntaxError` into a callback with no boundary. Route it through `readJson` with fallback `Could not record ${kind}.` for consistency with the rest.

`useExchangeLog`'s poll (`app/hooks/useExchangeLog.ts`) is already correct: it checks `res.ok` and wraps the whole tick in a `try`/`catch` that deliberately swallows a dropped poll. It is not changed.

### 6. Tests

**New file**: `app/lib/readJson.test.ts`

Unit tests over constructed `Response` objects: a 200 with valid JSON yields the data; a 400 with `{ error }` yields that error text; a 500 with an empty body yields the fallback plus the status and never a `SyntaxError` message; a 500 with an HTML body does the same.

**New file**: `app/lib/apiFailure.test.ts`

A handler that throws a P2022-shaped object yields a 500 whose JSON body carries the drift message and, in development, the hint. A handler that returns normally is passed through unchanged. A handler that throws an ordinary `Error` yields the generic message with nothing internal leaked.

**New file**: `app/components/IdeaPrompt.render.test.tsx`

The reproduction below, following the `*.render.test.tsx` convention already used by `app/components/AgentHandoff.render.test.tsx`.

## Reused existing code

- `createMap` from `app/lib/mapStore.ts` (glossary entry: `createMap`) — the call that throws P2022; unchanged, only its route gains handling.
- `IdeaPrompt` from `app/components/IdeaPrompt.tsx` (glossary entry: `IdeaPrompt`) — the component showing the parser error today.
- `parseBriefInput` from `app/lib/briefInput.ts` (glossary entry: `parseBriefInput`) — unchanged; named because it sits in the same handler being wrapped.
- `forward` in `app/lib/webmcp.ts` — the correct existing pattern (`res.ok` first, `res.text().catch()` second) that `readJson` generalises. Left alone; it already behaves.
- `classifyLoadError` from `app/lib/loadError.ts` — introduced by the plan this one depends on, `say-what-broke-not-prisma-s-stack`. Not present in the tree yet; this plan must not land before it.
- **Existing-implementation survey**: there is no route-level error wrapper and no shared client fetch helper in the repo today. `grep -rn "withFailure\|readJson\|safeJson" app` returns nothing; every route hand-rolls its own `NextResponse.json({ error }, { status })` and every client fetch hand-rolls its own `.json()`. `errorResponse` in `app/lib/toolInvocation.ts` (glossary entry: `errorResponse`) is the nearest existing helper and is deliberately NOT reused — it marks an *MCP tool result* as a fault for an agent to reason about, which is a different payload for a different audience than an HTTP error body.

## Reproduction Test

Pins the reported symptom: a failed `POST /api/maps` makes `IdeaPrompt` show the browser's JSON parser error instead of a sentence about the app.

**Target**: `app/components/IdeaPrompt.render.test.tsx` (new) — run with `codeyam-editor editor refresh-tests --test ideaPromptSurfacesServerFailure`.

```tsx
// A 500 with an empty body shows what broke, not the JSON parser's complaint.
it('surfaces a server failure without leaking a parse error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('', { status: 500 })),
  );
  render(<IdeaPrompt />);
  await userEvent.type(
    screen.getByRole('textbox'),
    'a subscription box for hot sauce',
  );
  await userEvent.click(screen.getByRole('button', { name: /start|send|→/i }));

  const message = await screen.findByText(/could not start a map/i);
  expect(message).toBeTruthy();
  expect(document.body.textContent).not.toMatch(/Unexpected end of JSON input/);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: today `submit` calls `response.json()` on the empty 500 body, the thrown `SyntaxError` is caught by the existing `catch`, and `setError` is handed `Failed to execute 'json' on 'Response': Unexpected end of JSON input` — so `findByText(/could not start a map/i)` times out and the `not.toMatch` assertion would fail too. The submit button's accessible name should be read off `IdeaForm` at execution rather than trusted from this regex.

## Scenarios to Demonstrate

- **Map creation against a drifted database, development** — the landing screen with the in-voice failure and the `npm run db:push` hint, no parser error anywhere.
- **Map creation against a drifted database, production** — the same screen with the message only: no command, no column name, no Prisma code.
- **Brief extraction fails** — the upload path's readout showing its own fallback rather than a `SyntaxError`.
- **A 502 with an HTML body** — a failure no route ever saw, still rendered as a sentence.
- **Happy path unchanged** — an idea typed and submitted against a healthy database still routes to `/map/:id` on the 201.
- **Exchange contribution fails** — `contribute` reporting `Could not record user.note.` instead of throwing a raw parse error into a callback.