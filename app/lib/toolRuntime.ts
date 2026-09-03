import 'server-only';

// What the catalog's tools actually DO.
//
// Split from `toolCatalog.ts` because these implementations reach the database,
// and the browser binding must be able to describe the tools without importing
// a line of Prisma. The catalog is the shared vocabulary; this is the shared
// behaviour behind it. Every front door — page, HTTP, stdio — ends up here, so
// a tool means the same thing whichever way it was called.

import type { z } from 'zod';
import { applyToolCalls, getAttachment, getBrief, getMap } from './mapStore';
import { attachmentNotFound, attachmentToolResult } from './attachmentTool';
import { splitIntoSections } from './briefSections';
import { computeBriefCoverage } from './briefCoverage';
import { formatInsightStanding, formatMapDetail, formatStandingWait } from './mcpFormat';
import {
  TARGET_LIVE_INSIGHTS,
  insightStream,
  type InsightStream,
} from './insightStream';
import {
  currentRevision,
  readSince,
  recordEvents,
  waitForUserActivity,
  type ExchangeEvent,
} from './exchange';
import { findConflictingChanges, needsConflictCheck } from './conflict';
import { renderEvents } from './exchangeFormat';
import {
  DEFAULT_TIMEOUT_SECONDS,
  findTool,
  timeoutMsFrom,
  type McpToolResponse,
  type ToolContext,
  type ToolResult,
} from './toolCatalog';

type Impl = (ctx: ToolContext, input: never) => Promise<ToolResult>;

/** The standing ask as numbers, carried on `structured` so an agent reading
 *  structured output does not have to parse the prose back into the figures it
 *  is being asked to compare itself against. The insights themselves are NOT
 *  here — they are already in the map the same call rendered, and repeating
 *  them would double the size of every read. */
function standing(stream: InsightStream) {
  return {
    live: stream.live,
    stale: stream.stale,
    answersSinceNewest: stream.answersSinceNewest,
    target: TARGET_LIVE_INSIGHTS,
  };
}

/** Read the post-write map because tool replies are the only place an agent
 * can be told it owes the person a wait. */
async function standingWait(mapId: string, revision: number): Promise<string> {
  const map = await getMap(mapId);
  return formatStandingWait(map?.nodes ?? [], revision);
}

/** One question as `ask_user` accepts it: the bare string it has always taken,
 *  or that string with a few suggested answers attached. The union is what
 *  makes the field additive — nothing an existing agent sends stops working. */
type AskedQuestion = string | { text: string; options?: string[] };

const IMPLEMENTATIONS: Record<string, Impl> = {
  async read_map(ctx, input: { sinceRevision?: number }) {
    if (typeof input.sinceRevision === 'number') {
      const { revision, events } = await readSince(ctx.mapId, input.sinceRevision);
      // The delta branch is the one a working agent actually calls, so the
      // standing ask has to appear here too — an ask only on the full read is
      // an ask the agent sees once, at the start, and never again. The cost is
      // this `getMap`, which the delta branch did not previously do. It is a
      // deliberate, stated cost: it is the difference between a mechanism that
      // works and one that reads well in a diff.
      const map = await getMap(ctx.mapId);
      const stream = insightStream(map?.nodes ?? []);
      return {
        text:
          `revision: ${revision}\n\n## Changes since r${input.sinceRevision}\n${renderEvents(events)}` +
          `\n\n${formatInsightStanding(stream)}`,
        structured: { revision, events, delta: true, insights: standing(stream) },
      };
    }
    const map = await getMap(ctx.mapId);
    if (!map) return { text: `No map with id ${ctx.mapId}.` };
    return {
      text: `revision: ${map.revision}\n${formatMapDetail(map)}`,
      structured: {
        revision: map.revision,
        delta: false,
        insights: standing(insightStream(map.nodes)),
      },
    };
  },

  async create_themes(
    ctx,
    input: { themes: unknown[]; requestId?: string },
  ) {
    const result = await applyToolCalls(
      ctx.mapId,
      [{ name: 'create_themes', input: { themes: input.themes } }],
      { origin: ctx.origin, requestId: input.requestId },
    );
    if (result.deduped) {
      return {
        text: `Already applied (requestId ${input.requestId}). The map is at revision ${result.revision}.`,
        structured: { revision: result.revision, deduped: true },
      };
    }
    // Hand the ids back rather than only a count: the agent named these by
    // ref, and without the real ids it could only attach nodes to them inside
    // the same call.
    const opened = result.events.filter((e) => e.kind === 'theme.added');
    const wait = await standingWait(ctx.mapId, result.revision);
    return {
      text:
        `Opened ${opened.length} theme(s): ` +
        opened
          .map((e) => {
            const p = e.payload as { id: string; label: string };
            return `${p.label} (${p.id})`;
          })
          .join(', ') +
        `. The map is now at revision ${result.revision}.${wait ? `\n\n${wait}` : ''}`,
      structured: { revision: result.revision, themes: opened.map((e) => e.payload) },
    };
  },

  async read_brief(ctx, input: { section?: string }) {
    const brief = await getBrief(ctx.mapId);

    // No brief is a perfectly ordinary state — most maps start from a sentence.
    // Saying so plainly, without `isError`, is the difference between an agent
    // moving on and an agent retrying a tool that will never succeed.
    if (!brief) {
      return {
        text: 'This map was not started from a brief — there is no document to read. The seed idea in read_map is all there is.',
        structured: { hasBrief: false },
      };
    }

    const sections = splitIntoSections(brief.text);

    // Coverage belongs in the outline because the person is being shown it. An
    // agent that has been working for twenty turns should be able to ask "what
    // have I not dealt with?" and get an answer, instead of re-reading the
    // whole document to find out — and if only the panel knew, the two halves
    // of the exchange would disagree about the same document.
    const map = await getMap(ctx.mapId);
    const coverage = computeBriefCoverage(sections, map?.nodes ?? []);
    const counted = new Map(coverage.sections.map((s) => [s.id, s]));

    const outline = [
      `# ${brief.sourceName}`,
      `${brief.charCount} characters, ${sections.length} section(s).`,
      `${coverage.covered} of ${coverage.total} accounted for by nodes on the map.`,
      '',
      ...sections.map((s) => {
        const n = counted.get(s.id)?.nodeCount ?? 0;
        return `[${s.id}] ${s.heading} — ${s.charCount} characters, ${n} node(s)`;
      }),
      '',
      coverage.untouched.length === 0
        ? 'Every section is cited by at least one node.'
        : `Nothing on the map cites ${coverage.untouched
            .map((s) => s.id)
            .join(', ')} yet.`,
      'Call read_brief again with a section id to read one in full.',
    ].join('\n');

    if (!input.section) {
      return {
        text: outline,
        structured: {
          hasBrief: true,
          sourceName: brief.sourceName,
          charCount: brief.charCount,
          covered: coverage.covered,
          total: coverage.total,
          untouched: coverage.untouched.map((s) => s.id),
          sections: sections.map(({ id, heading, charCount }) => ({
            id,
            heading,
            charCount,
            nodeCount: counted.get(id)?.nodeCount ?? 0,
          })),
        },
      };
    }

    const found = sections.find((s) => s.id === input.section);
    // An unknown id gets the outline back rather than an error: the agent's
    // next move is to pick a real section, and the outline is exactly what it
    // needs to do that.
    if (!found) {
      return {
        text: `There is no section ${input.section} in this brief.\n\n${outline}`,
        structured: { hasBrief: true, unknownSection: input.section },
      };
    }

    return {
      text: `# ${found.heading}\n(${found.id}, ${found.charCount} characters, from ${brief.sourceName})\n\n${found.text}`,
      structured: {
        hasBrief: true,
        section: found.id,
        heading: found.heading,
        charCount: found.charCount,
      },
    };
  },

  async read_attachment(ctx, input: { attachmentId: string }) {
    const attachment = await getAttachment(ctx.mapId, input.attachmentId);

    // Scoped by map, so an id belonging to another board is indistinguishable
    // from one that never existed — and both are an ordinary answer rather
    // than a fault, in the manner read_brief already sets for a map with no
    // brief.
    if (!attachment) return attachmentNotFound(input.attachmentId);

    // What an attachment IS to a reader that can look at pictures — a picture,
    // readable text, a PDF, or a name with nothing behind it — is a decision
    // that needs no database, so it lives in `attachmentTool.ts` where each
    // branch can be checked directly.
    return attachmentToolResult(attachment);
  },

  async add_nodes(ctx, input: { nodes: unknown[]; requestId?: string }) {
    const result = await applyToolCalls(
      ctx.mapId,
      [{ name: 'add_nodes', input: { nodes: input.nodes } }],
      { origin: ctx.origin, requestId: input.requestId },
    );
    if (result.deduped) {
      return {
        text: `Already applied (requestId ${input.requestId}). The map is at revision ${result.revision}.`,
        structured: { revision: result.revision, deduped: true },
      };
    }
    const wait = await standingWait(ctx.mapId, result.revision);
    return {
      text: `Added ${result.events.length} node(s). The map is now at revision ${result.revision}.${wait ? `\n\n${wait}` : ''}`,
      structured: { revision: result.revision, added: result.events.length },
    };
  },

  async update_node(
    ctx,
    input: {
      id: string;
      expectedRevision?: number;
      requestId?: string;
      [k: string]: unknown;
    },
  ) {
    const { expectedRevision, requestId, ...patch } = input;

    // A conflict is a RESULT, not an error. Last-write-wins would silently
    // erase what the person typed — the exact failure this spine exists to
    // prevent — and an `isError` would invite the agent to retry the clobber.
    {
      const now = await currentRevision(ctx.mapId);
      if (needsConflictCheck(expectedRevision, now)) {
        const { events } = await readSince(ctx.mapId, expectedRevision);
        const theirs = findConflictingChanges(events, input.id);
        if (theirs.length > 0) {
          return {
            text: [
              `Declined: the person changed this node after revision ${expectedRevision}.`,
              `The map is now at revision ${now}. Nothing was overwritten.`,
              '',
              'What you were going to write:',
              JSON.stringify(patch, null, 2),
              '',
              'What they changed:',
              renderEvents(theirs),
              '',
              'Read the map again and decide whether your change still applies.',
            ].join('\n'),
            structured: {
              conflict: true,
              revision: now,
              expectedRevision,
              theirChanges: theirs,
            },
          };
        }
      }
    }

    const result = await applyToolCalls(
      ctx.mapId,
      [{ name: 'update_node', input: patch }],
      { origin: ctx.origin, requestId },
    );
    if (result.events.length === 0 && !result.deduped) {
      return {
        text: `No node ${input.id} on this map — nothing was changed. The map is at revision ${result.revision}.`,
        structured: { revision: result.revision, changed: false },
      };
    }
    return {
      text: `Updated node ${input.id}. The map is now at revision ${result.revision}.`,
      structured: { revision: result.revision, changed: true },
    };
  },

  async set_phase(ctx, input: { phase: string }) {
    const result = await applyToolCalls(
      ctx.mapId,
      [{ name: 'set_phase', input: { phase: input.phase } }],
      { origin: ctx.origin },
    );
    // The tool replies are this app's only channel for steering an agent that
    // brings its own reasoning, so the one phase with a right answer says what
    // that answer looks like. A plan that ends in a numbered list of everything
    // reads as a plan to build all of it in order — which is the outcome this
    // whole product exists to prevent.
    const guidance =
      input.phase === 'next-steps'
        ? ' End this map on a build sequence, not just a to-do list: add "slice" nodes for the smallest increments worth building, smallest first, each naming with `tests` the assumption, risk, or open question it would settle. If an increment settles nothing, add it without `tests` rather than picking the nearest node — it will be shown as proving nothing, which is the honest answer. Put its rough effort in `detail`, in your own words.'
        : '';

    const wait = await standingWait(ctx.mapId, result.revision);
    return {
      text: `The map is now in the ${input.phase} phase, at revision ${result.revision}.${guidance}${wait ? `\n\n${wait}` : ''}`,
      structured: { revision: result.revision, phase: input.phase },
    };
  },

  async post_note(ctx, input: { text: string }) {
    const result = await recordEvents(ctx.mapId, [
      { kind: 'agent.note', origin: ctx.origin, payload: { text: input.text } },
    ]);
    const wait = await standingWait(ctx.mapId, result.revision);
    return {
      text: `Noted. The map is now at revision ${result.revision}.${wait ? `\n\n${wait}` : ''}`,
      structured: { revision: result.revision },
    };
  },

  async ask_user(
    ctx,
    input: { questions: AskedQuestion[]; timeoutSeconds?: number },
  ) {
    const before = await currentRevision(ctx.mapId);

    // A question is either a bare string or that string with suggested answers
    // attached. Normalising here rather than at each use is what lets the rest
    // of this tool stay exactly as it was — and what keeps `questions: ["…"]`,
    // the shape every existing agent sends, working verbatim.
    const asking = input.questions.map((question) =>
      typeof question === 'string' ? { text: question } : question,
    );

    // The questions become real open-question nodes FIRST, so they survive the
    // agent giving up, the page reloading, and the agent never coming back.
    await applyToolCalls(
      ctx.mapId,
      [
        {
          name: 'add_nodes',
          input: {
            nodes: asking.map((question, i) => ({
              ref: `q${i}`,
              kind: 'open-question',
              label: question.text,
              status: 'open',
              ...(question.options ? { options: question.options } : {}),
            })),
          },
        },
      ],
      { origin: ctx.origin },
    );
    const asked = await readSince(ctx.mapId, before);
    const questions = asked.events
      .filter((e: ExchangeEvent) => e.kind === 'node.added')
      .map((e: ExchangeEvent, i: number) => ({
        id: String((e.payload as Record<string, unknown>)?.id ?? `q${i}`),
        text: asking[i]?.text ?? '',
      }));

    await recordEvents(ctx.mapId, [
      { kind: 'question.asked', origin: ctx.origin, payload: { questions } },
    ]);

    const timeoutMs = timeoutMsFrom(input.timeoutSeconds);

    // Without a page there is nobody to ask. The server doors degrade to
    // leaving the questions on the map and handing back a cursor to poll,
    // rather than blocking on an interaction that can never arrive.
    if (!ctx.client) {
      const revision = await currentRevision(ctx.mapId);
      return {
        text: [
          `Asked ${questions.length} question(s). No page is attached to this session, so there is nobody to answer them here.`,
          `They are on the map as open questions. Tell them in chat what you asked and that their answers go on the map, then wait with await_user_activity from revision ${revision} (timeoutSeconds: ${DEFAULT_TIMEOUT_SECONDS}, re-called each time it expires) or read_map from the same revision.`,
        ].join('\n'),
        structured: { status: 'pending', revision, cursor: revision, questions },
      };
    }

    const ask = () => ctx.client!.askUser(questions, timeoutMs);
    const answers = ctx.client.requestUserInteraction
      ? await ctx.client.requestUserInteraction(ask)
      : await ask();

    if (!answers) {
      const revision = await currentRevision(ctx.mapId);
      return {
        text: [
          `No answer yet after ${Math.round(timeoutMs / 1000)}s — the wait is bounded, so this is expiry rather than refusal. The questions are still on the map.`,
          `Tell them in chat what you asked and that their answers go on the map, then call await_user_activity with sinceRevision: ${revision} and timeoutSeconds: ${DEFAULT_TIMEOUT_SECONDS} to keep waiting. Their answer lands in the log either way.`,
        ].join('\n'),
        structured: { status: 'pending', revision, cursor: revision, questions },
      };
    }

    const revision = await currentRevision(ctx.mapId);
    return {
      text: [
        'They answered:',
        ...answers.map((a) => `- ${a.text}\n  → ${a.answer}`),
        '',
        `The map is at revision ${revision}.`,
      ].join('\n'),
      structured: { status: 'answered', revision, answers },
    };
  },

  async await_user_activity(
    ctx,
    input: { sinceRevision: number; timeoutSeconds?: number },
  ) {
    const result = await waitForUserActivity(
      ctx.mapId,
      input.sinceRevision,
      timeoutMsFrom(input.timeoutSeconds),
    );
    if (result.timedOut) {
      return {
        // Says "normal" out loud. The wait is deliberately shorter than the
        // host's tool-call budget, so an agent working a map sees this reply
        // repeatedly and must not read the third one as the loop breaking.
        text: `Nothing from them yet — this is the normal bounded return, not a failure. The map is still at revision ${result.revision}. Call await_user_activity again right away with sinceRevision: ${result.revision} and timeoutSeconds: ${DEFAULT_TIMEOUT_SECONDS} to keep waiting. If you have not yet told them in chat what is on the map and that their answers go on the map, do that first.`,
        structured: {
          timedOut: true,
          revision: result.revision,
          cursor: result.revision,
        },
      };
    }
    const wait = await standingWait(ctx.mapId, result.revision);
    return {
      text: `They did this:\n${renderEvents(result.events)}\n\nThe map is at revision ${result.revision}.${wait ? `\n\n${wait}` : ''}`,
      structured: {
        timedOut: false,
        revision: result.revision,
        cursor: result.revision,
        events: result.events,
      },
    };
  },
};

/**
 * Validate and run one catalog tool.
 *
 * Agent input is untrusted, so it is checked against the tool's own schema
 * before it reaches an implementation, and a validation failure comes back as
 * readable text rather than a thrown exception the agent cannot act on.
 *
 * `isError` is reserved for genuine faults. A conflict or a timeout is a normal
 * result the agent is expected to reason about — flagging those as errors would
 * invite exactly the blind retry the conflict path exists to prevent.
 */
export async function runTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext,
): Promise<McpToolResponse> {
  const spec = findTool(name);
  const impl = IMPLEMENTATIONS[name];
  if (!spec || !impl) {
    return {
      content: [{ type: 'text', text: `No tool named ${name}.` }],
      isError: true,
    };
  }

  const parsed = (spec.inputSchema as z.ZodTypeAny).safeParse(rawInput ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return {
      content: [
        { type: 'text', text: `That input does not fit ${name}: ${problems}` },
      ],
      isError: true,
    };
  }

  try {
    const result = await impl(ctx, parsed.data as never);
    return {
      // Text first, then any pictures. The order is the point: an agent should
      // read what it is looking at before it looks at it, and a bare image
      // block with no caption is a thing with no provenance.
      content: [
        { type: 'text', text: result.text } as const,
        ...(result.images ?? []),
      ],
      ...(result.structured ? { structuredContent: result.structured } : {}),
    };
  } catch (err) {
    return {
      content: [
        { type: 'text', text: err instanceof Error ? err.message : String(err) },
      ],
      isError: true,
    };
  }
}
