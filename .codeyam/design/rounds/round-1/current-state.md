# Current state — the map workspace, before the brief panel

Round: `round-1` · Return: ui @ `ui-prepare`
Plan: **Show Which of the Brief Has Been Accounted For**
(`.codeyam/plans/completed/show-which-of-the-brief-has-been-accounted-for.md`)

## The surface being changed

`app/components/MapWorkspace.tsx` — today, twenty-eight lines and exactly two
children:

```tsx
<div className="flex min-h-0 flex-1 gap-6">
  <ThinkingMapView nodes={nodes} caption={caption} mapId={mapId} />
  <ExchangeColumn nodes={nodes} />
</div>
```

The plan adds a third pane — `BriefPanel` — to the **left** of
`ThinkingMapView`, mounted only when the map has a brief, plus a per-section row
component (`BriefSectionRow`) and a small section marker on `MapNodePill`'s
eyebrow. This is the first time the workspace becomes a three-column layout, so
the design question is real and not settled by the plan text.

## Scenarios that render it — ranked

**Tier 1 — the component being changed (5 scenarios, all Desktop, all captured):**

| Scenario | State it seeds |
|---|---|
| `mapworkspace-default` | 5 answered, 2 still open. The steady-state working view. |
| `mapworkspace-seeded` | Day one: one seed idea, 3 open questions, everything dashed. |
| `mapworkspace-quiet` | A map nobody has worked, no agent attached; the rail explains itself. |
| `mapworkspace-awaitinganswer` | An `ask_user` in flight — the person is blocked on. |
| `mapworkspace-justanswered` | A question resolved; one node wears the lime. |

**Tier 2 — the screen that threads coverage through (3 scenarios):**
`mapscreen-working`, `mapscreen-noagent`, `mapscreen-summary`. The plan
explicitly excludes the summary branch (no map to annotate), so `Working` is the
one that matters here.

**Tier 3 — the pill gaining the section marker (10 scenarios):**
`mapnodepill-default`, `-research`, `-justupdated`, `-openquestion`, `-gap`,
`-risk`, `-pro`, `-rootidea`, `-foldable`, `-folded`.

**Gap:** no scenario renders a brief at all. `MapBrief` and
`app/lib/briefSections.ts` shipped in the previous cycle, but nothing displays
them — the brief is currently readable only by the agent's `read_brief` tool.
The panel is therefore designed from scratch, not restyled.

## What the surface actually looks like today

Read from the captured PNGs under `.codeyam/scenarios/screenshots/`, not
inferred:

- **Ground.** Warm paper `#F1EFEA` edge to edge. Two white cards float on it
  with generous rounding (~16px) and no visible border — separation is by fill,
  not by line.
- **Proportion.** The map card takes roughly 70% of the width; the exchange
  column ~26%, with a `gap-6` gutter. The map card is the frame; the column is
  the narrow rail beside it.
- **Map card.** Top-left eyebrow `LIVE MAP` in muted 11px all-caps, followed by
  a sentence-case meta line in the same row ("5 answered, 2 still open" /
  "one seed, 3 open questions"). A tidy top-down tree fills the body. A zoom
  control (`− 100% + Fit`) floats bottom-right.
- **Nodes.** Everything is a pill, fully rounded. The root idea is solid black
  with white type — the one dark shape on the page. Settled nodes are white with
  a hard black hairline. Open questions are dashed and unfilled with grey type.
  Each pill sits under its own muted eyebrow (`PROBLEM`, `FINDING`, `GOAL ·
  YOURS`, `OPEN`) — note the `· YOURS` suffix, which is the existing precedent
  for appending a second fact to the eyebrow line. Connectors are dotted
  periwinkle `--thread` with small round terminals; fold controls are small
  circles straddling the pill's bottom edge.
- **Lime, used once.** In `justanswered`, exactly one pill carries a lime
  outline plus a soft lime glow, and its eyebrow reads `OPEN · JUST UPDATED` in
  lime. In `research`, a lime outline marks what the partner just found. In the
  exchange column the send buttons are lime circles. That is the whole budget.
- **Exchange column.** Eyebrow `WAITING ON YOU · 2`, then question/input pairs
  (rounded input, lime send button), a `NOTE / ADD NODE` toggle where the active
  side is a solid black pill, then an `ACTIVITY` eyebrow over a hairline-divided
  log. Log rows carry a small avatar dot — filled black for the agent, hollow
  ring for the person.
- **Type.** Manrope. One family throughout. Eyebrows 11px/700 at `0.12em`
  tracking; node labels ~14–15px/600; body 14px; meta 12.5px muted.

## What this round is trying to change

The workspace has to hold a third thing without stopping being a map. The brief
panel is a *document* — a linear, scannable list of sections with counts — set
beside an artifact that is spatial and mostly white space, and the map must keep
the frame it has today. The genuinely open questions the plan does not settle
are: how wide the panel is and whether it is a peer of the exchange column or
something quieter; how a section reads as **untouched** without borrowing lime,
which the design system reserves for the one thing that just changed, and
without borrowing `--risk`, which would make an unread page look like a defect
rather than a prompt; how the covered/total headline states coverage plainly
enough that a client reads it as evidence; and how small the `s7` marker on the
pill eyebrow can be while still being findable next to the existing `· YOURS`
badge. The panel must also be absent without a trace when a map has no brief —
`mapworkspace-quiet` and `-seeded` should look pixel-identical to the captures
above.
