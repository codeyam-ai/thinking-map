/**
 * The map narrating itself.
 *
 * The design system asks the line beside "LIVE MAP" to always say something
 * true about the current state rather than carry a fixed slogan — so this is
 * derived from the nodes, never hardcoded per screen.
 */
export function mapCaption(nodes: { status: string; kind: string }[]): string {
  if (nodes.length <= 1) return 'one seed, nothing else yet';

  const open = nodes.filter((n) => n.status === 'open').length;
  // The idea is the map's subject, not one of its findings — counting it would
  // overstate progress by one on every map.
  const answered = nodes.filter(
    (n) => n.status !== 'open' && n.kind !== 'idea',
  ).length;
  const updated = nodes.some((n) => n.status === 'updated');

  // A change the person just made outranks the arithmetic: after a pivot, the
  // reassurance that nothing was lost is the thing they need to read.
  if (updated) return 'nothing gets lost, only added';

  if (answered === 0) {
    return `one seed, ${open} open question${open === 1 ? '' : 's'}`;
  }
  if (open > 0) {
    return `${answered} answered, ${open} still open`;
  }
  return 'grows as you talk';
}
