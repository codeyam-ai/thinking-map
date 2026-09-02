import {
  ACCENT_KINDS,
  familyOf,
  type NodeFamily,
  type NodeKind,
  type NodeStatus,
} from './mapKinds';

/** The card shell for each family: its own line as the border, its own tint as
 *  the fill. Written out rather than interpolated because Tailwind reads class
 *  names as literals — a built string never reaches the generated CSS. */
const FAMILY_SHELL: Record<NodeFamily, string> = {
  subject: 'border border-fam-subject-line bg-fam-subject-fill text-ink',
  question: 'border border-fam-question-line bg-fam-question-fill text-ink',
  ground: 'border border-fam-ground-line bg-fam-ground-fill text-ink',
  found: 'border border-fam-found-line bg-fam-found-fill text-ink',
  judgment: 'border border-fam-judgment-line bg-fam-judgment-fill text-ink',
  forward: 'border border-fam-forward-line bg-fam-forward-fill text-ink',
};

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
 *   accent    pro / risk keep their own two colours; every other kind wears
 *             its FAMILY's line and tint (see KIND_FAMILY in mapKinds)
 *   answered  falls through to the same family treatment
 *
 * Status still beats kind, and that is the rule that must not break. Kind
 * colour slots in at the accent tier and NOWHERE ABOVE IT, so an unanswered
 * question is still dashed and unfilled whatever family it belongs to —
 * "nobody has answered this" outranks "this is a question about users" — and
 * the one node that just changed still wears the lime alone.
 *
 * Gaps deliberately fall through rather than reading as a warning: they are
 * the most valuable thing the research phase produces. They land in the
 * `question` family, which is what a gap actually is.
 */
export function nodeShellClasses({
  kind,
  status,
  isRoot,
}: NodeAppearance): string {
  // The root used to be the only dark shape on the page. That was right when a
  // node was a pill: inverting 30px of pill reads as emphasis. Inverting 240px
  // of CARD reads as a hole in the page, and it would take the eye before the
  // one lime card that is supposed to have it. So the subject family keeps the
  // ink LINE and gives up the ink fill, and the doubled border is what carries
  // the weight instead. Root is still first in the precedence; only what it
  // resolves to changed.
  if (isRoot) return 'border-2 border-fam-subject-line bg-fam-subject-fill text-ink';

  if (status === 'updated') {
    return 'border-2 border-lime bg-surface text-ink shadow-[0_0_0_4px_rgba(213,245,96,0.35)]';
  }
  if (status === 'open') {
    return 'border border-dashed border-line bg-transparent text-muted';
  }

  // Pro and risk keep the two colours the design system already assigned them
  // rather than being flattened into a shared judgment hue — the whole point of
  // that pair is that they point opposite ways. They take the judgment family's
  // tint underneath, so they still read as one family at a glance.
  const accent = ACCENT_KINDS[kind as NodeKind];
  if (accent === 'risk')
    return 'border border-risk bg-fam-judgment-fill text-ink';
  if (accent === 'pro') return 'border border-pro bg-fam-judgment-fill text-ink';

  return FAMILY_SHELL[familyOf(kind)];
}

/**
 * The colour a family draws its mark and its thread in, as a CSS variable
 * reference — for the places that need a paint value rather than a class,
 * which is the SVG thread layer and the accent mark's fill.
 *
 * Pro and risk resolve to their own colours here for the same reason they do
 * above: a thread up to a risk should be the risk colour, not a family average.
 */
export function familyLineVar(kind: string): string {
  const accent = ACCENT_KINDS[kind as NodeKind];
  if (accent === 'risk') return 'var(--risk)';
  if (accent === 'pro') return 'var(--pro)';
  return `var(--fam-${familyOf(kind)}-line)`;
}
