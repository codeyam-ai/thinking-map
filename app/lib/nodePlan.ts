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
      if (Object.keys(data).length === 0) continue;
      updates.push({ id, data });
    }
  }

  return { inserts, updates, phase };
}
