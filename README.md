# Thinking Map

An AI thinking partner that helps you deconstruct a vague idea, explore the problem
space, and turn your thinking into a visual map and an actionable plan.

You arrive with something you cannot yet describe — *"I want to build an educational
game for kids, but I don't know what it should be"* — and instead of answering, the
partner names what it doesn't know and asks the two or three questions that would
change what you should build. Every answer becomes a node on a map that grows beside
the conversation. When it helps, it searches the web for what already exists and hangs
the findings, and the gaps in them, off the map. Change direction and nothing is lost:
the map updates and tells you what changed. You leave with what you know, what you
don't, the strongest directions, and where to start tomorrow.

The central principle: **don't just give me an answer — help me understand the problem
well enough to find a better answer.**

## The loop

| Phase | What happens |
| --- | --- |
| 01 Idea | You type something vague into one free-text input. No structured fields. |
| 02 Deconstruct | The partner asks a small number of high-value questions instead of answering. |
| 03 Map | Your answers become nodes: users, problems, goals, assumptions, open questions. |
| 04 Research | A live web search grounds the map in what already exists, and in the gaps. |
| 05 Explore | You change direction; the map adds and updates, and explains what changed. |
| 06 Next steps | What we know, what we don't, three directions, five concrete steps. |

## Setup

```bash
npm run setup   # install dependencies, create the SQLite database
npm run dev     # start the dev server on http://localhost:3000
```

The production database starts **empty** by design — you see the day-one state and
populate it by using the app. Each registered scenario carries its own seed data, so
every screen can be viewed in every state without touching production data.

### Talking to the model

The conversation needs an Anthropic API key. Put it in `.env.local` (gitignored):

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

Without a key the app still runs and every seeded scenario renders; sending a message
returns a plain explanation rather than a generic error.

## MCP server

Everything the web UI can do to a thinking map, an MCP client can do too — through the
same store, so the two surfaces cannot drift apart. Six tools:
`list_thinking_maps`, `get_thinking_map`, `create_thinking_map`, `add_map_nodes`,
`update_map_node`, `set_map_phase`.

**Over HTTP** — `POST /api/mcp` (streamable HTTP; send
`Accept: application/json, text/event-stream`).

**Over stdio**, for clients that launch the server as a child process:

```bash
npm run mcp
```

To register it with Claude Desktop, add to its MCP config:

```json
{
  "mcpServers": {
    "thinking-map": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/this/project"
    }
  }
}
```

## How it's built

- **Next.js + Prisma + SQLite.** Three tables: `ThinkingMap`, `Message`, `MapNode`.
  The map is a tree via a nullable `parentId`, so there is no separate edge table.
- **`app/lib/mapStore.ts`** is the only place that reads or writes a map; both the web
  UI and the MCP server go through it.
- **`app/lib/thinkingPartner.ts`** is the only place that talks to a model
  (`claude-opus-5`, adaptive thinking, plus Anthropic's server-side `web_search` — so
  the Research phase needs no separate search provider). Every decision the agent loop
  makes lives in `app/lib/turnInterpreter.ts`, which is pure and tested.
- **The map's geometry** is `app/lib/mapLayout.ts` — a tidy-tree layout returning
  absolute pixel positions, tested for sibling non-overlap, parent centring, orphaned
  parents, and cycle termination.

### Two notes for anyone picking this up

`package.json` runs `next dev --webpack`. Next 16 defaults to Turbopack, and Turbopack's
dev output does not hydrate through the codeyam preview proxy — no client component
becomes interactive. This is deliberate, not a leftover.

Navigation anchors carry `suppressHydrationWarning`. The preview proxy rewrites
`href="/"` to `href="/__codeyam_preview/"` in the served HTML while React's payload
still says `/`. The rewrite is correct and wanted; only the warning needed silencing.

## Development

```bash
npx tsc --noEmit                        # type-check
codeyam-editor editor refresh-tests     # run the test suite
codeyam-editor editor scenarios         # list every registered scenario
```

Before adding a feature that touches auth, file uploads, email, or another
external service, read [`FEATURE_PATTERNS.md`](FEATURE_PATTERNS.md) — it sets out
the local-first approach this stack expects and the upgrade path for each.
[`DATABASE.md`](DATABASE.md) covers schema changes and where credentials belong.

Built with [CodeYam](https://codeyam.com) — `codeyam editor` to launch the editor.
