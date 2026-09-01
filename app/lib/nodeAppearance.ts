import { ACCENT_KINDS, type NodeKind, type NodeStatus } from './mapKinds';

export interface NodeAppearance {
  kind: NodeKind | string;
  status: NodeStatus | string;
  isRoot: boolean;
}

/**
 * Pick the shell classes for a map node.
 *
 * Status drives the treatment — the single most important rule in the design
 * system — and the precedence below encodes it:
 *
 *   root      the map's subject, and the only dark shape on the page
 *   updated   exactly one node per screen wears the lime: what just changed
 *   open      dashed and unfilled, because nobody has answered it
 *   accent    pro / risk / research carry colour; nothing else does
 *   answered  a plain ink pill
 *
 * Gaps deliberately fall through to `answered`: they are the most valuable
 * thing the research phase produces, not a warning, and the mockups draw them
 * as plain pills.
 */
export function nodeShellClasses({
  kind,
  status,
  isRoot,
}: NodeAppearance): string {
  if (isRoot) return 'border-ink bg-ink text-white';

  if (status === 'updated') {
    return 'border-2 border-lime bg-surface text-ink shadow-[0_0_0_4px_rgba(213,245,96,0.35)]';
  }
  if (status === 'open') {
    return 'border-dashed border-line bg-transparent text-muted';
  }

  const accent = ACCENT_KINDS[kind as NodeKind];
  if (accent === 'risk') return 'border-risk bg-surface text-ink';
  if (accent === 'pro') return 'border-pro bg-surface text-ink';
  if (accent === 'find') return 'border-lime-deep bg-surface text-ink';

  return 'border-ink bg-surface text-ink';
}
