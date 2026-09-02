---
title: "dr-design changes -- Wrap and Explain the MCP Handoff Block"
mode: ui
createdAt: "2026-09-02T20:26:09Z"
prefix: "dr-design changes"
source: manual
---

## Summary

The handoff panel's MCP block is both visually broken and under-explained. The
long origin-bearing command (`claude mcp add --transport http thinking-map
https://…/api/mcp`) renders in `CopyablePrompt`'s `default` tone, which is the
one tone with no wrapping rule at all — so the URL runs straight out of its
rounded box. And the copy around it never says what the command is *for*, or
that it is Claude Code-specific: someone attaching a different agent (ChatGPT
desktop, Cursor) needs the endpoint URL for their own connector settings, not a
`claude mcp` invocation they cannot run. Fix the overflow in the shared tone,
surface the bare `<origin>/api/mcp` endpoint as its own copyable block, and
rewrite the surrounding paragraph to say plainly what attaching buys you and
which door is which.

## Key Decisions

- **Fix the wrap in `CopyablePrompt`'s `default` tone, not at a call site.**
  `primary` already carries `break-words` and `inline` deliberately carries
  `truncate`; `default` is the only tone with no rule, which is why the same
  bug would reappear at any other caller handing it a long token. One class on
  the shared constant fixes the footnote and both `HandoffReattach` grid cells
  at once.
- **Add `mcpUrl` beside `mcpCommand` rather than replacing it.** The command is
  genuinely the fastest path for a Claude Code user and there are registered
  tests pinning its presence on both the full band and the reattach strip.
  Removing it to make room for the URL would trade one audience's convenience
  for another's. Both are cheap; show both.
- **The new URL block goes in `HandoffFootnote` only.** `HandoffReattach` is
  for someone who has already attached an agent once and knows which door they
  use — and its `dense` variant is a deliberate one-row budget on the
  finished-plan screen, where a third block would cost the summary a row for a
  fact that reader already has.
- **Say what is true about the browser-agent door, including its limit.** The
  in-page bridge needs `navigator.modelContext` (Chrome 146+, top-level, secure
  context — see `webMcpUnavailableReason`). Opening the app in an agent that
  does not implement WebMCP does *not* attach it, so the copy must not imply
  "any agentic browser and you're done". The honest framing is: if an agent can
  already reach this page, this panel is hidden entirely; if you are reading
  this, it cannot, and one of these two blocks is how you fix that.
- **Keep the existing "Copy MCP command" label.** Registered render tests find
  the block by that label; renaming it is churn with no reader benefit when a
  second, differently-labelled block is arriving next to it.

## Implementation

### 1. Let the default tone wrap

**File**: `app/components/CopyablePrompt.tsx`

Add `break-words` to `PROMPT_CLASS.default`, matching `primary`. Extend the
existing comment above the constants to record why: `default` holds
origin-bearing commands whose URL is a single unbreakable token wider than the
box, and `overflow-wrap: break-word` is the rule that breaks it only when it
does not fit — unlike `inline`'s `truncate`, which is a deliberate one-row
choice, and unlike leaving it unset, which is not a choice at all.

Nothing else in the tone changes. The registered test `CopyablePrompt › renders
the default tone when none is given` asserts only that the *button* lacks
`bg-lime`, so it is unaffected.

### 2. Give the copy an endpoint and a reason

**File**: `app/lib/handoffCopy.ts`

- Add `mcpUrl: string` to `HandoffCopy` — `${origin}/api/mcp` when `origin` is
  known, and the relative `/api/mcp` on the server render, mirroring how
  `mcpCommand` already degrades to `npm run mcp`. Document on the field that it
  is the portable half: the address is the same fact every MCP client needs,
  while the command is one client's spelling of it.
- Add `mcpPurpose: string` — one short paragraph stating what attaching does
  (an agent gets this map's tools, so it can read the brief, add nodes and ask
  questions without anything being pasted back and forth), and that the command
  below is the Claude Code shortcut while any other agent takes the URL in its
  own connector settings.
- Rewrite `attachHint` so it stops being a single dense sentence carrying four
  facts. It should name the two doors and be honest that the browser-agent door
  needs a browser that implements WebMCP (Chrome 146+, top level, secure
  context) — an agentic browser without it cannot see this page, which is why
  this panel is on screen at all. Keep the `await_new_map` reference: a
  registered test pins it, and it is the one sentence explaining why the MCP
  door needs nothing copied on the *next* idea.

Wording lives here rather than in the components for the reason the module
header already gives — it is the interface, and it is pinned by tests.

### 3. Render the endpoint and the reason

**File**: `app/components/HandoffFootnote.tsx`

Accept `mcpPurpose` and `mcpUrl` alongside the existing props. Render, in
order: `explanation`, `attachHint`, `mcpPurpose`, then the two copy blocks —
`mcpUrl` labelled `Copy MCP URL`, then `mcpCommand` at its existing
`Copy MCP command` label. Keep both at the `default` tone: the start prompt
above stays the only promoted control on the band, which is the arrangement
this component's docstring exists to defend.

Extend the docstring to cover what is now grouped here — the explanation, the
two doors, and the two spellings of the same endpoint — so the grouping stays a
stated decision rather than an accumulation.

### 4. Pass the new copy through

**File**: `app/components/AgentHandoff.tsx`

Pass `copy.mcpPurpose` and `copy.mcpUrl` into `HandoffFootnote`. No change to
the `HandoffReattach` branch or to the `listening` / `workedByAgent` logic.

### 5. Capture the states that would regress

**File**: `app/isolated-components/HandoffFootnote/page.tsx`

Update `Default` and `ServerRender` with the new props, and add a third
scenario — a narrow-column or long-origin frame whose URL is comfortably wider
than the box — so the wrap is something a capture can *see*. The current
`Default` fixture already carries the long
`https://thinking-map.example.com/api/mcp` form, which is exactly the string
that reproduces the reported overflow; the new frame exists so a regression
cannot hide behind a short origin.

### 6. Tests

**File**: `app/lib/handoffCopy.test.ts`

Pin `mcpUrl` in both forms (origin known → `https://maps.example.com/api/mcp`;
origin absent → `/api/mcp`), and pin that `mcpPurpose` names the non-Claude
path — the fact a rewrite would most plausibly drop, and the one this change
exists to add.

**File**: `app/components/AgentHandoff.render.test.tsx`

Assert the full band offers the endpoint URL as well as the command, and that
the reattach strip still offers only the command — the deliberate subtraction
from decision three, which a presence-only test elsewhere cannot see come
undone.

## Reused existing code

- `CopyablePrompt` from `app/components/CopyablePrompt.tsx` (glossary entry:
  `CopyablePrompt`) — the new URL block is another instance of it at the
  existing `default` tone, not a new control.
- `handoffCopy` from `app/lib/handoffCopy.ts` — every new string is a field on
  the existing return type; no second copy module.
- `HandoffFootnote` from `app/components/HandoffFootnote.tsx` — the grouping
  component the new paragraph and block belong to by its own stated remit.
- `webMcpUnavailableReason` from `app/lib/webmcp.ts` — the authority for what
  the browser-agent door actually requires (secure context, top-level frame,
  `navigator.modelContext`). The new `attachHint` wording must not claim more
  than this function can return.
- Existing-implementation survey: there is no existing wrapping utility,
  truncation helper, or second copy-block component — `PROMPT_CLASS` in
  `app/components/CopyablePrompt.tsx` is the only place wrapping is decided, and `handoffCopy`
  is the only source of handoff wording. Nothing equivalent to `mcpUrl` exists
  today; `/api/mcp` is spelled out only inside the `attachHint` prose and in
  `mcpCommand`.

## Reproduction Test

The `default` tone carries no wrapping rule, so a long unbroken URL overflows
its box instead of wrapping inside it.

**Target**: `app/components/CopyablePrompt.render.test.tsx` — run with
`codeyam-editor editor refresh-tests --test copyable-prompt-default-tone-wraps`.

```tsx
// A long origin-bearing MCP command is a single unbreakable token wider than
// the box that holds it. Without a wrapping rule it renders OUTSIDE that box —
// the reported bug — and only `break-words` puts it back inside.
it('wraps a long command inside the default tone box', () => {
  stubClipboard(() => Promise.resolve());
  const { container } = render(
    <CopyablePrompt text="claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp" />,
  );
  expect(container.querySelector('p')?.className).toMatch(/break-words/);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `PROMPT_CLASS.default`
is `'mt-4 rounded-2xl border border-line px-4 py-3 font-mono text-[12px] leading-[1.6]'`,
so the `toMatch(/break-words/)` assertion fails on a className with no wrapping
rule in it.

A class assertion rather than a measured layout one is deliberate: jsdom has no
layout, so nothing in this suite can observe an actual overflow. The class is
the thing that is either there or not, and it is what the fix changes. The
visual claim is settled by the scenario capture in step 5, not here.

## Scenarios to Demonstrate

- Full band, origin known — the long HTTPS command wrapped inside its box, with
  the endpoint URL block and the purpose paragraph beneath the start prompt.
- Full band, server render — the `npm run mcp` / `/api/mcp` fallback pair, where
  neither string is long enough to wrap and the group must still read as one.
- Narrow viewport — the frame where the URL is widest relative to its box, and
  the one that reproduces the reported overflow before the fix.
- Reattach strip, default — unchanged: start prompt and command, no endpoint
  block, heading intact.
- Reattach strip, dense — the finished-plan one-row variant, still one row.
- Agent attached — the panel renders nothing at all, which is the state that
  makes "if you can read this, no agent can reach the page" a true sentence.