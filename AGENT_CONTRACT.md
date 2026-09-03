# Connecting an agent

The map is a shared artifact, not a chat log. The app never calls a model itself — the
agent is the one you already have, and it brings its own credentials. There is no API
key to set.

An agent can reach a map three ways, and all three run the same tool catalog
(`app/lib/toolCatalog.ts` declares the tools, `app/lib/toolRuntime.ts` implements them
once), so no door can drift from the others.

**In the page (WebMCP).** The agent lives in the browser and the page publishes its
tools to it. This needs Chrome 146+ (`navigator.modelContext`), HTTPS or localhost, and
the top-level frame — WebMCP is unavailable inside an iframe, deliberately. When any of
that is missing the page says so rather than pretending to be connected.

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

## The tools

Shared by all three doors: `read_map`, `create_themes`, `read_brief`, `read_attachment`,
`add_nodes`, `update_node`, `set_phase`, `post_note`, `ask_user`, and
`await_user_activity`.

`list_thinking_maps`, `create_thinking_map` and `await_new_map` are server-door-only — a
page is already on one map, so none of the three has anything to offer it.

## WebMCP is pull-only — the contract an agent should follow

A page cannot wake an agent. There is no push channel, and the person editing the map is
under no obligation to wait for anyone. So the exchange is a durable, ordered record
rather than a live connection: every map carries a monotonic `revision`, and every change
— yours or theirs — is one append-only event tagged with who made it.

Habits that follow from that, and the tools are shaped to make them easy:

- **Read with a cursor.** `read_map { sinceRevision }` returns only what happened after
  that revision, so you never re-ingest your own writes as new information.
- **Write with a `requestId`.** `add_nodes` and `update_node` take one, and a retry
  carrying the same value returns the original revision instead of writing twice.
- **Wait with `await_user_activity`,** not a polling loop. It blocks until the person
  actually does something.
- **Say in chat what you did and what you need.** Tool replies are invisible to the
  person — they see a map, not your tool results. An agent that writes questions and
  then parks silently leaves someone looking at a board with no idea anything is owed
  from them. So the reply to every write that leaves questions open explicitly sends you
  back to chat for a sentence or two: what went on the map, and that answers go on the
  map too.
- **Park on `await_new_map` when you have no map yet.** Same idiom one level up: it
  blocks until somebody starts a map anywhere, then hands you each new one with its seed
  idea and whether it came from a brief.

Two more things worth knowing:

- **Conflicts come back as results, not errors.** Pass `expectedRevision` to
  `update_node`; if the person changed that node since you read it, the write is declined
  and both versions are described back to you. Nothing is overwritten.
- **Each wait is short on purpose; the patience comes from the loop.** `ask_user`,
  `await_user_activity` and `await_new_map` take a `timeoutSeconds` and, on expiry, hand
  back a cursor rather than hanging. The default is 25 seconds, and `timedOut: true` is
  the normal return rather than a failure — re-call immediately with the cursor and no
  contribution can slip through the gap. The limit is not this server's: *your host*
  decides when a tool call has run too long, and a browser agent aborts an in-flight
  WebMCP call after tens of seconds while a stock MCP client gives up at sixty. Ask for a
  longer `timeoutSeconds` only if you know your own host will wait that long.

## Driving the tools without an agent

WebMCP needs a top-level secure context, so it is genuinely absent in previews and
captured scenarios. The page therefore always publishes a headless driver over the same
bound catalog:

```js
await window.__thinkingMapAgent.callTool('read_map', {});
await window.__thinkingMapAgent.callTool('post_note', { text: 'what I changed and why' });
```

The page-side binding forwards each call to `POST /api/maps/:id/tools`, which runs the
same implementation the other two doors use. `GET|POST /api/maps/:id/exchange` is the
log itself — read it with `?since=`, and post a `user.answer`, `user.note`, or
`user.node` as the person.

Outside production the page can also summon an **Agent panel** (bottom right) on
request: add `?agentPanel=1` to the URL. It calls `window.__thinkingMapAgent`, the same
bound catalog a real agent uses, so its "run the demo sequence" button exercises the
genuine tool paths rather than a mock of them.
