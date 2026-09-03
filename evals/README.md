# Tool description evals

`app/lib/toolCatalog.ts` is the only place this app can steer an agent, and
until this directory existed it was the only file that could change the
product's behaviour with nothing to catch it.

The descriptions in that catalog are not labels. `add_nodes` spends three
paragraphs teaching the insight-vs-themed-node distinction. `set_phase` argues
against a named failure mode — "rounds that only ever add more questions never
arrive anywhere". `read_brief` pleads with the agent to read the outline before
walking every section. That is prompt engineering, and the 58 deterministic
vitest files under `app/lib/` cannot test it: they prove that a tool registers,
that a descriptor survives a structured clone, that bad input is rejected. None
of them prove a model reads the words and does the right thing.

This suite does. Its job is to make a diff to `toolCatalog.ts` **reviewable** —
you can see whether a re-worded description still produces the behaviour it was
written to produce.

## These are NOT part of `npm test`

Deliberately. They cost money per run and they are probabilistic; wiring them
into the blocking suite would make an unrelated commit fail on a coin flip.
They get their own script and are run on purpose, when `toolCatalog.ts`
changes.

## Running them

You need a model API key (see **The key** below), then:

```bash
# A cheap single pass
npm run evals -- --model anthropic:claude-haiku-4-5-20251001

# A thorough pass — three runs per case, which is how you tell a real
# regression from one unlucky sample
npm run evals -- --model anthropic:claude-haiku-4-5-20251001 --runs 3
```

`--model` and `--runs` are deliberately left to the caller so a cheap smoke
pass and a thorough multi-run pass are the same script. Everything after `--`
is forwarded to the CLI, so `--reporter console` (skip the HTML report),
`--max-steps N` and `--analyze` all work too.

Reports land in `.evals/` and are gitignored — a JSON/HTML report per run is
scratch, not history.

### The model string is `provider:model`

`webmcp-evals` resolves the model itself, from a `provider:model` prefix:

| Prefix       | Key it reads                                                  |
| ------------ | ------------------------------------------------------------- |
| `anthropic:` | `ANTHROPIC_API_KEY`                                           |
| `openai:`    | `OPENAI_API_KEY`                                              |
| `google:`    | `GOOGLE_AI` / `GEMINI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` |
| `ollama:`    | none — `OLLAMA_HOST`, default `http://127.0.0.1:11434/v1`     |

With no prefix it defaults to Google. `--backend vercel` (what the script
passes) means "drive the loop with the Vercel AI SDK's `generateText`" — it is
**not** a route through the Vercel AI Gateway, and there is no gateway path in
this CLI. Swapping models is a matter of the `--model` string plus the matching
key; no config file is involved.

Each provider also honours a `*_BASE_URL` override (`OPENAI_BASE_URL`,
`ANTHROPIC_BASE_URL`, `GOOGLE_GENERATIVE_AI_BASE_URL`) if you do want to point
at a gateway or proxy.

### The key

Put it in `.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env.local` is the only file in this repo where an uncommitted secret can
live — `.gitignore` ignores `.env*.local`, and `app/lib/loadEnv.ts` documents
the cascade. **Do not put a key in `.env`**: that file is committed.

This matters because the CLI runs its own `dotenv.config()`, which reads `.env`
and nothing else. The `evals` script therefore preloads `.env.local` ahead of
it (`DOTENV_CONFIG_PATH=.env.local NODE_OPTIONS=--require=dotenv/config`);
dotenv does not overwrite variables that are already set, so `.env.local` wins.
An already-exported shell variable wins over both, which is the other perfectly
good way to supply the key.

## `tools.schema.json` is GENERATED — do not hand-edit it

```bash
npm run evals:schema        # regenerate from the catalog
npm run evals:schema:check  # fail if the committed copy is stale
```

`scripts/emit-tool-schema.ts` writes it from `TOOL_CATALOG`, converting each
tool's Zod schema with the same `jsonSchemaFor()` the page binding uses. So the
evals run against the identical bytes a browser agent is handed, and a
re-worded description cannot pass an eval it no longer matches.

It is committed rather than generated on demand for one reason: a generated
artifact that only exists after you remember to run a script is a file that is
silently stale. Committing it puts the schema diff in review next to the
description diff that caused it, which is most of the point. `evals:schema:check`
regenerates to a temp path and diffs, so the committed copy is trustworthy —
run it (or just `npm run evals:schema`) after any catalog edit.

`annotations` (the catalog's `readOnlyHint`) is not emitted: local mode never
reads it, so it could not affect a result.

## Local mode, and why

`local` shows the model the static schema file and judges which tool it calls
with which arguments. No dev server, no database, nothing executed — tool
"results" come from a mock resolver inside the CLI, fed by each case's
`mockOutput`. That matters more here than it would elsewhere: two of the ten
tools (`ask_user`, `await_user_activity`) deliberately BLOCK waiting on a
person, so any mode that ran the real tools would hang or need elaborate
stubbing. Tool *selection* is also exactly the surface the descriptions own.

The CLI also has `browser` and `smoke` modes for live pages. Steering that lives
in tool *reply* text — `formatStandingWait` in `app/lib/mcpFormat.ts` — only
exists when tools genuinely execute against a real map, and local mode cannot
produce it. That is what the browser suite below is for. `smoke` remains unused:
it executes tools without a model, so it cannot judge what an agent does next,
which is the entire question a reply-text case asks.

## Browser mode, and the one case that needs it

`npm run evals:browser` runs `suites/standing-wait.json` against a real page in
a real browser. It exists for one behaviour that local mode is structurally
unable to reach.

The behaviour is the standing wait. When a tool call leaves open questions on a
map, `formatStandingWait` appends a paragraph to the tool's REPLY telling the
agent to say something in chat and then call `await_user_activity` "rather than
ending your turn". That paragraph is the entire fix — it is prose, not code, and
it is prose the model only ever sees if a tool actually ran against a map that
actually has open questions. Local mode shows the model a static schema file and
answers its calls from `mockOutput`, so the sentence is never generated and the
case would be testing the fixture rather than the product.

### What it needs that local mode does not

| Requirement    | Why                                                              |
| -------------- | ---------------------------------------------------------------- |
| A real Chrome  | The CLI drives the page through `puppeteer-core`'s `channel`, which resolves a Chrome **installed on the machine**. The Playwright Chromium `postinstall` fetches is a different browser and does **not** satisfy it. |
| WebMCP enabled | The CLI launches with `--enable-features=WebMCP`, so the channel has to be one that ships the flag. Its default is `chrome-canary`; on Linux, where there is no Canary, use `--chrome-channel chrome-dev` with `google-chrome-unstable` installed. |
| A dev server   | `bindTools` (`app/lib/webmcp.ts`) registers the catalog from the page. No server, no tools — the CLI fails with "0 tools registered on page". |
| A database     | The tools write. `read_map`, `add_nodes` and `await_user_activity` all reach Postgres for real. |

The model API key is the same as local mode's — see **The key** above.

### It cannot touch your development data

This is the one property worth checking before you run it, and it is enforced
rather than documented: `scripts/run-browser-evals.ts` takes your
`DATABASE_URL`, **replaces** its `?schema=` parameter with a freshly minted
`eval_standing_wait_<hex>`, pushes the tables into that schema, seeds the map
there, points the dev server at it, and drops the schema in a `finally`. The
cluster is shared; nothing else is. It is the same unit of isolation the
integration tests use (`app/lib/testDatabase.ts`).

Two consequences worth knowing:

- **Never point it at production.** Schema isolation protects your data from the
  eval, not the eval from a bad URL — `prisma db push` against a hosted database
  still creates and drops a schema there. The README's standing rule holds: the
  deployed database starts empty by design and an eval has no business in it.
- **It starts its own dev server**, on a free port, with `NEXT_DIST_DIR` set to
  `.next-evals`. That separate build directory is why a `npm run dev` you
  already have open is not disturbed.

### Running it

```bash
npm run evals:browser -- --model anthropic:claude-haiku-4-5-20251001

# On Linux, where there is no Chrome Canary:
npm run evals:browser -- --model anthropic:claude-haiku-4-5-20251001 \
  --chrome-channel chrome-dev
```

Everything after `--` is forwarded to `webmcp-evals browser`, so `--runs 3`,
`--reporter console` and `--max-steps N` work exactly as they do locally.

### The case, and how it is shaped

`suites/standing-wait.json` holds one case. Browser runs are slow and cost a
model call per step; this buys the one regression the repo has already been
bitten by, and more can follow now that the harness is proven.

The seeded map (`scripts/seed-eval-map.ts`) is a houseplant-subscription board
in the `map` phase carrying **two** open questions — the number matters, because
`formatStandingWait` returns an empty string at zero and the fixture would then
prove nothing. The case asks for more questions on an existing theme, so the
expected trajectory is `add_nodes` and then `await_user_activity` carrying a
numeric `sinceRevision`.

Two shaping decisions follow from the matcher's rules (see **Writing a case**
below, all of which apply here too):

- **The pair is an `ordered` group, and that is the whole assertion.** There is
  no way to say "and then the turn did not end", so the failure being caught is
  the *absence* of the second call. An agent that writes questions and stops
  fails the case, which is exactly the bug.
- **`await_user_activity` really blocks**, for `DEFAULT_TIMEOUT_SECONDS` (25) per
  call, and returns `timedOut: true`. The reply then tells the agent to call it
  again — correct behaviour that would otherwise score as an extra call and fail
  the case. Hence the trailing optional `await_user_activity` nodes: they absorb
  the loop the product is asking for. The run cannot wedge, because every call
  is bounded.

## The six cases

`suites/tool-selection.json`. Every case exists because a specific sentence in
a description is trying to prevent a specific mistake — each case's `name`
quotes the sentence it defends. A case that did not correspond to something a
description argues for would be testing the model rather than the catalog, and
would not be worth paying for.

1. **Themes before nodes.** `create_themes` says "Create the themes first, then
   pass each node a themeRef." Asserts an `ordered` trajectory:
   `create_themes`, then `add_nodes`.
2. **A finding inside one theme carries a themeRef.** `add_nodes` says a node
   "WITH a themeRef stays in its row". Asserts one node whose `themeRef` is
   present.
3. **Outline before passages.** `read_brief` says to read the outline first and
   pull only the passages you need. Asserts the outline call, then exactly one
   sectioned call, for the section that actually answers the question — and
   nothing more. Walking all eight sections of the fixture fails the case,
   which is the expensive mistake the description is written to prevent.
4. **Incremental re-read.** On a returning turn, asserts `read_map` carries a
   numeric `sinceRevision` rather than being called bare.
5. **The arc ends.** Given "everything on the board is answered", asserts
   `set_phase` to `next-steps` — not another `add_nodes` round. This is the
   failure mode `set_phase`'s prose argues against, and nothing else checks
   that the argument works.
6. **The old name still works.** An agent told to use the legacy `deconstruct`
   phase must still produce a valid `set_phase` call, since
   `ACCEPTED_PHASE_NAMES` keeps it accepted and the description promises it
   resolves to `map`.

## Writing a case: what the matcher can and cannot do

Worth reading before you add one, because two of these are not obvious and both
will otherwise waste a paid run.

- **Free-text arguments get `$pattern` / `$contains` / `$type` / `$any`, never
  an exact string.** A case that pins an exact `label` is testing the model's
  prose, will flake, and will train you to ignore the suite.
- **You cannot assert that a field is ABSENT.** Objects are matched as a
  *subset*: every key you name must be present and match, and extra keys are
  ignored. There is no `$absent` and no negation. This is why case 2 asserts
  only the themed half of the insight/themed-node distinction, and why case 3
  bounds the *number* of `read_brief` calls instead of asserting the first one
  carried no `section`.
- **Arrays are matched strictly** — same length, positionally. So
  `nodes: [ {...} ]` requires exactly one node; to say "some nodes, don't care
  which" use `nodes: { "$type": "array" }`. Case 2 asks the model for exactly
  one node for this reason.
- **An extra tool call fails the case.** Any actual call beyond what
  `expectedCall` consumes is scored as a failure. Where a plausible-but-
  irrelevant call could happen (a leading `read_map`, a trailing `post_note`),
  add it as `{"functionName": "...", "optional": true}` — an optional node that
  would fail simply doesn't consume the call. Where the extra call IS the
  mistake under test, leave it out, as case 5 does.
- **`mockOutput`** on a node is what the model gets back when it calls that
  tool, which is how a multi-step case (read the outline, then pull a section)
  gets plausible data to reason about. Resolution is by tool name only, in
  trajectory order, each node consumed once.
- **Prior turns** go in `messages` as `{"type": "functioncall", "name", "arguments"}`
  and `{"type": "functionresponse", "name", "response"}` pairs — that is how
  cases 2, 4 and 5 establish a map that already exists.
