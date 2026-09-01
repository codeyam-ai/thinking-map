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
| `--thread` | `#8B8BC8` | The dotted connector between map nodes. |
| `--risk` | `#C4736A` | Risk and warning node borders. Used sparingly. |
| `--pro` | `#6B9E84` | Pro and opportunity node borders. Used sparingly. |

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
- Border width is `1px` everywhere, `2px` only on a node that is currently highlighted.
- No shadows, no gradients. Depth comes from white-on-paper, not from blur.

## 4. The map

The map is the product's signature. It is a top-down tree, centered on the root idea.

- **Connectors are dotted**, `--thread`, `1.5px`, with a small filled dot where a connector
  meets a node. Dotted because the structure is provisional — this is thinking in progress,
  not an org chart.
- **Node status drives its treatment**, and this is the most important rule in the system:
  - `open` — dashed border, no fill, `--muted` label. A question nobody has answered.
  - `answered` — solid `--ink` border, white fill, ink label. Settled.
  - `updated` — `--lime` border at 2px with a lime glow. Exactly what just changed.
  - the root `idea` node — solid `--ink` fill, white label. The one dark shape on the page.
- **Every node carries an eyebrow** naming its kind, so the map reads without a legend.
- Nodes never overlap. Siblings distribute evenly under their parent; the tree grows
  downward and outward, and the whole map scales to fit its panel rather than scrolling —
  but only down to a legibility floor. A map too large to fit above that floor scrolls
  instead, because a readable map you have to pan beats an illegible one that fits.

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
