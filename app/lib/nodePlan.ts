import {
  isNodeKind,
  isNodeStatus,
  isPhase,
  type NodeKind,
  type NodeStatus,
  type Phase,
} from './mapKinds';

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
export function planMapMutations(calls: ToolInvocation[]): MapMutationPlan {
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
          sourceRef: node.sourceRef ? String(node.sourceRef) : null,
          options: serialiseOptions(node.options),
          order: order++,
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

  return { inserts, updates, phase };
}
