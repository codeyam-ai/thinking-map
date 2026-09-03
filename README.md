# Thinking Map

[![CI](https://github.com/codeyam-ai/thinking-map/actions/workflows/ci.yml/badge.svg)](https://github.com/codeyam-ai/thinking-map/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](./LICENSE)

An AI thinking partner that helps you deconstruct a vague idea and turn your thinking
into a visual map and an actionable plan.

You arrive with something you cannot yet describe — *"I want to build an educational
game for kids, but I don't know what it should be"* — and instead of answering, the
partner asks the two or three questions that would change what you should build. Every
answer becomes a node on the map. You leave with what you know, what you don't, the
strongest directions, and the smallest thing worth building first.

The central principle: **don't just give me an answer — help me understand the problem
well enough to find a better answer.**

The map moves through five phases: **01 Idea → 02 Map → 03 Research → 04 Explore →
05 Next steps.**

## Run it locally

```bash
npm run setup   # install dependencies, provision PostgreSQL, push the schema, seed
npm run dev     # http://localhost:3000
```

Nothing has to be installed or hosted first. With no `DATABASE_URL` set, `setup` starts
a local PostgreSQL server of its own and writes the connection string to `.env.local`.
Set `DATABASE_URL` yourself and that database is used instead, untouched. See
[`DATABASE.md`](DATABASE.md).

No API key is needed. The app never calls a model itself — the agent is the one you
already have, and it brings its own credentials. See
[`AGENT_CONTRACT.md`](AGENT_CONTRACT.md) for the three ways an agent can attach.

<!-- codeyam:run-and-edit:start -->
## Develop this project with codeyam-editor

This project is built with [codeyam-editor](https://codeyam.com) — code and runnable data scenarios are authored side by side against a live preview.

```bash
# Clone the repo
git clone https://github.com/codeyam-ai/thinking-map && cd thinking-map

# Install codeyam-editor
npm install -g @codeyam-editor/codeyam-editor@latest

# Launch the editor (split-screen terminal + live preview)
codeyam-editor start
```
<!-- codeyam:run-and-edit:end -->

Every screen has runnable scenarios carrying their own seed data, so any state can be
viewed without touching real data:

```bash
codeyam-editor editor scenarios       # list every registered scenario
codeyam-editor editor refresh-tests   # run the test suite
npx tsc --noEmit                      # type-check
```

## What it looks like

Each of these is a registered scenario — a real state of the app, captured.

### The way in

<img src=".codeyam/scenarios/screenshots/day-one-nothing-yet--tablet.png" alt="A single yellow card on a black screen asking &quot;What are you trying to figure out?&quot;" width="420">

One card, one free-text box. No structured fields. You can also attach a brief — browse
for a `.pdf` / `.docx` / `.md` / `.txt` / `.html`, or point at a page — and with one
attached the sentence becomes optional.

### The map mid-round

<img src=".codeyam/scenarios/screenshots/sprawling-a-deep-wide-map--tablet.png" alt="A full-height dark board: one idea card on the left, four coloured branches fanning right into rows of question and finding cards" width="600">

Your idea sits on the left. Each coloured branch is a theme the partner pulled out of
it, and the cards hanging off it are what it wants to know. A question and the node it
becomes are the same card — you answer inside the map rather than reading the question
in one place and answering it in another. The bar along the top always says what is
still waiting on you.

### One map, both hands on it

<img src=".codeyam/scenarios/screenshots/mid-exchange-agent-and-human-on-one-map--tablet.png" alt="The board mid-exchange, with cards contributed by the agent and by the person on the same branches" width="600">

The partner writes to the map and so do you, and the map does not distinguish between
the two by putting them in separate places. An answered question and a node the agent
added sit on the same branch, because what matters is where a thought belongs, not who
had it.

### Arriving with a brief

<img src=".codeyam/scenarios/screenshots/brief-attached-nothing-cited-yet--tablet.png" alt="The board seeded from an attached brief, with the source document standing behind the first card" width="600">

A twenty-page spec is stored whole as the map's source. The partner reads it the way
anyone reads a long document — the outline first, then the passages that matter — so a
long brief cannot quietly fill the context that ought to be spent thinking about it.

### The plan you leave with

<img src=".codeyam/scenarios/screenshots/a-plan-with-a-gap-one-slice-proves-nothing--desktop.png" alt="A build sequence where one slice is marked &quot;proves nothing yet&quot;, above a five-step track" width="420">

A plan is a build sequence, not a to-do list. Each increment names the assumption or
open question that building it would settle — and one that settles nothing is marked
**proves nothing yet** rather than sitting in the sequence looking like progress.

### What to do next

<img src=".codeyam/scenarios/screenshots/complete-what-to-do-next--desktop.png" alt="The summary screen: next five steps as a left-to-right track, with the activity log below" width="420">

The end of the loop: what you know, what you don't, the directions worth taking, and
five concrete steps in order — plus the activity log of everything that happened to the
map, from both sides.

## Notes for anyone picking this up

- `package.json` runs `next dev --webpack`. Next 16 defaults to Turbopack, and
  Turbopack's dev output does not hydrate through the codeyam preview proxy. This is
  deliberate, not a leftover.
- A plain `npm run dev` does not serve `/isolated-components/*`, the fixture pages
  scenario captures render from — they would fill your dev session with convincing fake
  maps. Use `CODEYAM_APP_PORT=1 npm run dev` if you want them.
- Before adding a feature that touches auth, file uploads, email, or another external
  service, read [`FEATURE_PATTERNS.md`](FEATURE_PATTERNS.md).

## Contributing

Issues and pull requests are welcome. [`CONTRIBUTING.md`](CONTRIBUTING.md) covers
getting set up, the checks a change has to pass, and the few conventions here that
look like mistakes and are not. Everyone taking part is expected to uphold the
[Code of Conduct](CODE_OF_CONDUCT.md); to report a vulnerability, see
[`SECURITY.md`](SECURITY.md) rather than opening an issue.

## License

[MIT](./LICENSE) © 2026 CodeYam.

<!-- codeyam:scenario-gallery:start -->
## Scenario gallery

States captured as runnable scenarios with codeyam-editor:

### A board with pictures, a drawn shape and a shortlist

<img src=".codeyam/scenarios/screenshots/a-board-with-pictures-a-drawn-shape-and-a-shortlist--tablet.png" alt="A board with pictures, a drawn shape and a shortlist" width="280">

### A plan with a gap - one slice proves nothing

<img src=".codeyam/scenarios/screenshots/a-plan-with-a-gap-one-slice-proves-nothing--desktop.png" alt="A plan with a gap - one slice proves nothing" width="280">

### A brief, and nobody has picked it up yet

<img src=".codeyam/scenarios/screenshots/a-brief-and-nobody-has-picked-it-up-yet--tablet.png" alt="A brief, and nobody has picked it up yet" width="280">

### Complete - what to do next

<img src=".codeyam/scenarios/screenshots/complete-what-to-do-next--desktop.png" alt="Complete - what to do next" width="280">

### All eight, the list expanded

<img src=".codeyam/scenarios/screenshots/all-eight-the-list-expanded--tablet.png" alt="All eight, the list expanded" width="280">

### Weighing the alternatives against each other

<img src=".codeyam/scenarios/screenshots/weighing-the-alternatives-against-each-other--desktop.png" alt="Weighing the alternatives against each other" width="280">

### An older question, three rounds up, still open

<img src=".codeyam/scenarios/screenshots/an-older-question-three-rounds-up-still-open--tablet.png" alt="An older question, three rounds up, still open" width="280">

### Brief attached, nothing cited yet

<img src=".codeyam/scenarios/screenshots/brief-attached-nothing-cited-yet--tablet.png" alt="Brief attached, nothing cited yet" width="280">
<!-- codeyam:scenario-gallery:end -->
