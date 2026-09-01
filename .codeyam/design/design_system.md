# Thinking Map

> Warm paper, hard ink, one electric lime. Everything is a pill. Structure is drawn in dotted lines, because the thinking isn't finished yet.

Synthesized from the six reference mockups in `.codeyam/design/user_files/`, anchored on the
built-in **KeyLime** palette (`design_systems/keylime.md`) — the mockups' paper, ink, and
chartreuse are within a hair of KeyLime's tokens. Where the two disagree, the mockups win:
KeyLime chamfers its corners, Thinking Map rounds them all the way to pills.

## How to use this system

Three layers, applied in order:

1. **Core language** (always applies) — the color tokens, the pill geometry, the type scale,
   the dotted connector. Every surface inherits these.
2. **Essential components** — node pill, eyebrow label, phase nav, chat bubble, panel card,
   prompt input, suggestion chip. Enough vocabulary to build any screen in the product.
3. **Showcase patterns** (opt-in) — the oversized landing question, the all-caps
   `I DIDN'T BUILD THE PRODUCT YET.` declaration on the summary screen. Use them only on the
   two screens that earn them; they are the product's voice, not decoration to sprinkle.

## 1. Color

Light only. This product is a sheet of paper you think on; there is no dark mode.

| Token | Value | Role |
|---|---|---|
| `--paper` | `#F1EFEA` | Page ground. Warm, never white. |
| `--surface` | `#FFFFFF` | Panel and card fill, floating on paper. |
| `--ink` | `#0F0F0F` | Primary type; the fill of a resolved node. |
| `--ink-soft` | `#4A4A45` | Body copy inside cards. |
| `--muted` | `#8A8A85` | Eyebrow labels, inactive nav, metadata. |
| `--line` | `#E2E0D9` | Hairline borders, inactive pill outlines. |
| `--lime` | `#D5F560` | The single accent. Send buttons, active phase, "just updated". |
| `--lime-deep` | `#C6EC44` | Lime pressed / border on a lime fill. |
| `--thread` | `#8B8BC8` | The violet of the `question` family; once the tree's connectors. |
| `--risk` | `#C4736A` | Risk node borders and threads. Used sparingly. |
| `--pro` | `#6B9E84` | Pro node borders and threads. Used sparingly. |

The map's card families add a `line` and a near-white `fill` token each
(`--fam-<family>-line` / `--fam-<family>-fill`, plus `--fam-found-band`). They reuse
`--thread`, `--risk` and `--pro` rather than adding near-duplicates, and none of them is
lime. See §4 for the table and the rule they sit under.

**Contrast rules.** Ink on paper and ink on lime both clear AA comfortably. Never put
`--muted` on `--lime`, and never use lime as a text color — it is a fill and a border only.
Lime is load-bearing: it marks exactly one thing per screen, the thing that just changed.

## 2. Typography

One family. `Manrope` where available, falling back to the system sans stack — the mockups'
geometric grotesque reads as Manrope's cousin, and a system fallback keeps the dev server
offline-instant.

| Role | Size / weight | Notes |
|---|---|---|
| Landing question | 56–72px / 800, `-0.02em` | Two lines, balanced. The showcase moment. |
| Declaration | 40–52px / 700, uppercase | Summary screen only. |
| Panel heading | 12px / 700, `0.14em`, uppercase | `CONVERSATION`, `LIVE MAP`. |
| Node label | 14–15px / 600 | Inside the pill. Never wraps past two lines. |
| Eyebrow | 11px / 700, `0.12em`, uppercase, `--muted` | Sits above a node: `IDEA`, `OPEN`, `GAP`. |
| Body | 14px / 400, 1.55 | Chat bubbles, card copy. |
| Meta | 12.5px / 400, `--muted` | Timestamps, counts, the line beside `LIVE MAP`. |

Sentence case everywhere except eyebrows, panel headings, and the one declaration.

## 3. Shape

**Everything is a pill or a generously rounded rectangle. There are no sharp corners.**

- Node pill, chip, button, input: `border-radius: 999px`.
- Panel, card: `border-radius: 20px`.
- Chat bubble: `border-radius: 18px`.
- Border width is `1px` everywhere; `2px` only on the two cards that outrank the rest — the
  root idea, and the one node that just updated.
- No shadows, no gradients. Depth comes from white-on-paper, not from blur.

## 4. The map

The map is the product's signature. It is a **column of card rows, growing downward and
scrolled like a page** — not a tree on a plane. It was a tidy top-down tree; zoom, pan,
fit-to-frame and drag-to-nudge all existed to make a large 2D tree navigable, and a column
is navigated by scrolling, so all of it went. The tree is still in the data (`parentId` and
`order` are untouched, and the tool contract is unchanged); only the drawing changed.

**A row is a round** — the batch of nodes one write put on the map, read off the exchange
log rather than off tree depth. Everything in a row arrived together, and the next one
appears below it.

**The card.** `20px` radius, `1px` border, `240px` minimum height, `220–300px` wide. Anatomy,
top to bottom: the `round/total` marker top-left in the family's line colour and the family
icon top-right; then open space; then the eyebrow, the label, and — for a question — the
answer affordance or the answer itself. The open space is deliberate: the reading matter sits
at the bottom of the card, as in the reference.

**Six colour families, not eighteen kinds.** One hue per kind would be a legend. The kinds
collapse into six families (`KIND_FAMILY` in `app/lib/mapKinds.ts`), each with a `line` token
for its mark and thread and a near-white `fill` token for the card:

| family | kinds | line |
| --- | --- | --- |
| `subject` | idea | `--fam-subject-line` (ink) |
| `question` | open-question, unknown, gap | `--fam-question-line` (violet) |
| `ground` | user, problem, goal, constraint, assumption, known | `--fam-ground-line` (dusty blue) |
| `found` | research, finding | `--fam-found-line` (ochre) |
| `judgment` | pro, risk | `--pro` / `--risk`, per kind |
| `forward` | approach, direction, next-step, slice | `--fam-forward-line` (mauve) |

Fills are near-white tints, never saturated: a card is a large area, and chroma belongs on
the icon and the thread where it is a few pixels wide. **No family may use lime.**

**Status still beats kind. This is the most important rule in the system**, and kind colour
slots in below it, never above. The precedence, encoded in `nodeShellClasses`:

- the root `idea` — `2px --ink` border on white. It is no longer a dark FILL: inverting a
  30px pill read as emphasis, but inverting 240px of card reads as a hole in the page and
  takes the eye before the lime card that should have it.
- `updated` — `--lime` border at `2px` with a lime glow. **Exactly one per screen**: the
  thing that just changed. Its family icon keeps its own colour underneath.
- `open` — dashed border, no fill. A question nobody has answered is dashed *whatever family
  it belongs to* — "nobody has answered this" outranks "this is a question about users".
- otherwise — the family's line and fill.

**Threads.** One short curve per card, from the bottom edge of the card in the previous round
that prompted it to the top edge of this one, `1.75px` at ~55% opacity in the **child's**
family colour, with a small filled endpoint dot. Not a full edge graph: the rows already
carry the structure, so drawing every parent–child edge would be a thicket crossing the
column. A card draws no thread when its parent is more than one round back, when it has no
parent, or when the row wrapped and it sits on a second line — there is no honest lane to a
wrapped card, and silence is the correct drawing. Threads from one parent **fan** across its
bottom edge in the order of the children they land on, so they read as a hand opening rather
than a frayed rope. They paint above the research band and below the cards.

**The research band.** A round that is mostly `research` / `finding` / `gap` (strictly more
than half) gets its own territory rather than just its own colour: a `--fam-found-band`
ground, a hairline enclosure, and the eyebrow `WHAT ALREADY EXISTS` in place of the round
number. The root round never bands.

**The ground.** A faint dot grid (`.dot-grid`, 1px on a 22px pitch) under the column, which is
what makes a near-white card read as placed on something rather than floating. It stands on
its own in an empty map. Rounds older than the two newest step back to `96%` opacity —
recession, not perspective; no transforms, which would move the answer boxes out from under
the pointer.

**Every card carries an eyebrow** naming its exact kind, which is what lets six families be
enough.

## 5. Components

**Panel** — white, `20px` radius, `1px --line` border, on paper. Heading is an eyebrow at
top-left; an optional meta line sits beside it in `--muted` ("grows as you talk", "two
answered, one still open"). That meta line is the map narrating itself and should always
say something true about the current state.

**Phase nav** — a single pill-shaped track in `--surface` holding six numbered labels
(`01 IDEA` … `06 NEXT STEPS`). The active one is a `--lime` pill with ink text; the rest are
`--muted`. Completed phases are not visually distinguished from upcoming ones — this is a
map of the process, not a progress bar.

**Chat bubble** — user turns are `--ink` fill with white text, right-aligned. Assistant turns
are a warm `#EFEDE6` fill with ink text, left-aligned, preceded by a small dark circular
avatar. Assistant messages that pose questions put each question on its own line in `600`
weight — the questions are the product, so they get typographic weight.

**Prompt input** — full-width pill, `1.5px --ink` border, white fill, with a `--lime` circular
send button holding a `↗` arrow. This is the only place lime appears on the landing screen.

**Suggestion chip** — small white pill, `--line` border, `--ink-soft` label. Clicking one
fills the prompt input rather than submitting, so the person stays in control of their words.

## 6. Motion

Restrained and purposeful. A node entering the map fades and scales from `0.96` over `220ms`
`ease-out`. The lime "just updated" treatment holds for two seconds, then settles to
`answered`. Connectors draw in over `300ms`. Nothing bounces, nothing pulses continuously —
the map should feel like it is being *thought*, not animated.

## 7. Voice

The AI is a thinking partner, not an answer machine, and the copy carries that:

- It names what it doesn't know before it offers anything.
- It says what changed and why, in one sentence, after every map update.
- It never says "Great question!" or "Certainly!". It says "Interesting." or "That changes a
  few things, not everything."
- Empty states describe the next action, not the absence of data.
- The summary screen opens by admitting what it did *not* do — `I DIDN'T BUILD THE PRODUCT
  YET.` — because the honesty is the point of the product.
