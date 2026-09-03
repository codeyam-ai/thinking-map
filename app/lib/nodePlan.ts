import {
  isNodeKind,
  isNodeStatus,
  isPhase,
  type NodeKind,
  type NodeStatus,
  type Phase,
} from './mapKinds';
import { readTradeoffs, type Tradeoffs } from './tradeoffs';

/** A node the model asked for, validated but not yet written. */
export interface PlannedInsert {
  /** The model's temporary handle, so later nodes can name it as a parent. */
  ref: string | null;
  /** A ref from earlier in this plan, or the real id of an existing node. */
  parentRef: string | null;
  kind: NodeKind;
  label: string;
  detail: string | null;
  status: NodeStatus;
  sourceUrl: string | null;
  /**
   * What this slice would settle. Like `parentRef`, this is either a ref from
   * earlier in this same plan or the real id of an existing node — a slice
   * usually names an assumption the agent created moments before it — so it
   * has to survive the same resolution pass rather than being written raw.
   */
  testsRef: string | null;
  /**
   * What this insight was drawn out of. Resolved exactly as `testsRef` above
   * is — refs from this same call or real ids of existing nodes — because an
   * insight usually cites the very questions the agent answered moments before
   * writing it.
   *
   * The difference from `testsRef` is arity: a slice settles ONE node, an
   * insight comes out of several. Null rather than `[]` when the agent named
   * nothing, so a node that cited no sources is indistinguishable from one
   * written before the field existed.
   */
  fromRefs: string[] | null;
  /** The brief section this node came from, when it came from one. Dropped
   *  when absent, exactly as `sourceUrl` is. Unlike `testsRef` above it is
   *  NOT a node ref, so it needs no resolution pass — it points out of the
   *  map at the document, not at another node. */
  sourceRef: string | null;
  /** Suggested answers for an open question, already serialised to the JSON
   *  array the column stores — SQLite has no array type. Null when the model
   *  offered none, which is the ordinary case. */
  options: string | null;
  order: number;
  /** A ref from earlier in this plan, or the real id of an existing theme. */
  themeRef: string | null;
  /** Offered options, or null for an open-ended question. */
  choices: string[] | null;
  imageUrl: string | null;
  imageAlt: string | null;
  diagram: { steps: string[]; note?: string } | null;
  /** What this would take and what taking it would cost, or null. Validated
   *  through `readTradeoffs`, which is total — so a shape the model got wrong
   *  becomes a card with no tradeoffs rather than a write that fails. */
  tradeoffs: Tradeoffs | null;
}

/** A theme the model asked to open, validated but not yet written. The hue is
 *  absent on purpose: it is assigned at write time from the map's existing
 *  theme count, which this pure function cannot know. */
export interface PlannedTheme {
  ref: string;
  label: string;
}

/** A change to a node that already exists. */
export interface PlannedUpdate {
  id: string;
  data: Partial<{
    label: string;
    detail: string;
    kind: NodeKind;
    status: NodeStatus;
    testsNodeId: string;
    /** Settable after the fact: an agent often only works out where a claim
     *  came from on a later pass, once it has read more of the brief. */
    sourceRef: string;
  }>;
}

export interface MapMutationPlan {
  themes: PlannedTheme[];
  inserts: PlannedInsert[];
  updates: PlannedUpdate[];
  phase: Phase | null;
}

export interface ToolInvocation {
  name: string;
  input: unknown;
}

/**
 * Suggested answers, ready to store.
 *
 * Dropped entirely unless there is at least one usable string, so a model that
 * sends `options: []` or a list of blanks produces a plain question rather than
 * a node carrying an empty array nobody can render. Non-strings are filtered
 * rather than stringified: `[1, 2]` is a mistake, and `"1"` as a suggested
 * answer would hide it.
 */
function serialiseOptions(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const options = raw.filter(
    (option): option is string =>
      typeof option === 'string' && option.trim().length > 0,
  );
  return options.length > 0 ? JSON.stringify(options) : null;
}

/**
 * Turn the model's tool calls into a validated plan of map changes.
 *
 * Pure on purpose: deciding WHAT to write is the part with the interesting
 * rules — unknown kinds are dropped rather than stored, so the map can only
 * ever contain shapes it knows how to draw — while actually writing the rows
 * is thin. Splitting them keeps the rules testable without a database.
 *
 * Insert order is preserved because a parent must be written before the child
 * that names it.
 */
/** Validate a diagram the model asked for. A shape that cannot be drawn — no
 *  steps, or steps that are all blank — becomes null rather than an empty box,
 *  because a card announcing a diagram and showing nothing is worse than one
 *  that never claimed to have one. */
/**
 * The refs an insight cites, ready for the resolution pass.
 *
 * Strings only, blanks dropped, and an empty result normalised to null — the
 * same shape `serialiseOptions` above uses, and for the same reason: a node
 * that named nothing should be indistinguishable from one that never had the
 * field, rather than carrying an empty array nobody can render.
 */
function readRefs(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const refs = raw.filter(
    (ref): ref is string => typeof ref === 'string' && ref.trim().length > 0,
  );
  return refs.length > 0 ? refs : null;
}

function readDiagram(raw: unknown): { steps: string[]; note?: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const steps = Array.isArray(d.steps)
    ? d.steps.map((x) => String(x ?? '').trim()).filter(Boolean)
    : [];
  if (steps.length < 2) return null;
  const note =
    typeof d.note === 'string' && d.note.trim() ? d.note.trim() : undefined;
  return note ? { steps, note } : { steps };
}

export function planMapMutations(calls: ToolInvocation[]): MapMutationPlan {
  const themes: PlannedTheme[] = [];
  const inserts: PlannedInsert[] = [];
  const updates: PlannedUpdate[] = [];
  let phase: Phase | null = null;

  for (const call of calls) {
    const input = (call.input ?? {}) as Record<string, unknown>;

    if (call.name === 'set_phase') {
      const next = String(input.phase ?? '');
      // Last valid set_phase wins; an invalid one leaves the phase untouched
      // rather than dropping the map into a state the nav cannot render.
      if (isPhase(next)) phase = next;
      continue;
    }

    if (call.name === 'create_themes') {
      const incoming = Array.isArray(input.themes) ? input.themes : [];
      for (const raw of incoming) {
        const theme = (raw ?? {}) as Record<string, unknown>;
        const ref = String(theme.ref ?? '').trim();
        const label = String(theme.label ?? '').trim();
        // A theme with no ref is unreachable — no node could name it — and one
        // with no label would render as an unlabelled cluster. Drop both rather
        // than put a galaxy on the board that cannot be navigated to.
        if (!ref || !label) continue;
        themes.push({ ref, label });
      }
      continue;
    }

    if (call.name === 'add_nodes') {
      const incoming = Array.isArray(input.nodes) ? input.nodes : [];
      let order = 0;
      for (const raw of incoming) {
        const node = (raw ?? {}) as Record<string, unknown>;
        const kind = String(node.kind ?? '');
        const label = String(node.label ?? '').trim();
        if (!isNodeKind(kind) || !label) continue;

        const status = String(node.status ?? 'answered');
        inserts.push({
          ref: node.ref ? String(node.ref) : null,
          parentRef: node.parentRef ? String(node.parentRef) : null,
          kind,
          label,
          detail: node.detail ? String(node.detail) : null,
          status: isNodeStatus(status) ? status : 'answered',
          sourceUrl: node.sourceUrl ? String(node.sourceUrl) : null,
          testsRef: node.tests ? String(node.tests) : null,
          fromRefs: readRefs(node.fromRefs),
          sourceRef: node.sourceRef ? String(node.sourceRef) : null,
          options: serialiseOptions(node.options),
          order: order++,
          themeRef: node.themeRef ? String(node.themeRef) : null,
          diagram: readDiagram(node.diagram),
          // Round-tripped through the same reader the board uses, so the model
          // writing a shape and the card reading one can never disagree about
          // what counts as usable. A blank object becomes null rather than an
          // empty panel, which is where the reader is strict.
          tradeoffs: readTradeoffs(
            node.tradeoffs ? JSON.stringify(node.tradeoffs) : null,
          ),
          imageUrl: node.imageUrl ? String(node.imageUrl) : null,
          imageAlt: node.imageAlt ? String(node.imageAlt) : null,
          // Blank options are dropped rather than rendered as empty pills, and
          // a list that empties out becomes null — an open-ended question,
          // which is the honest fallback.
          choices: Array.isArray(node.choices)
            ? (() => {
                const cleaned = (node.choices as unknown[])
                  .map((c) => String(c ?? '').trim())
                  .filter(Boolean);
                return cleaned.length > 0 ? cleaned : null;
              })()
            : null,
        });
      }
      continue;
    }

    if (call.name === 'update_node') {
      const id = String(input.id ?? '');
      if (!id) continue;
      const data: PlannedUpdate['data'] = {};
      if (input.label) data.label = String(input.label);
      if (input.detail) data.detail = String(input.detail);
      if (input.kind && isNodeKind(String(input.kind))) {
        data.kind = String(input.kind) as NodeKind;
      }
      if (input.status && isNodeStatus(String(input.status))) {
        data.status = String(input.status) as NodeStatus;
      }
      if (input.tests) data.testsNodeId = String(input.tests);
      if (input.sourceRef) data.sourceRef = String(input.sourceRef);
      if (Object.keys(data).length === 0) continue;
      updates.push({ id, data });
    }
  }

  return { themes, inserts, updates, phase };
}
