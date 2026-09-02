import CardIcon from './CardIcon';
import { familyLineVar } from '../lib/nodeAppearance';

/**
 * The top line of a card: which round it arrived in, and which family it is.
 *
 * The two marks are deliberately at opposite corners and deliberately the same
 * colour. A card can be clipped by the edge of the column or by a narrow
 * viewport, and putting the family colour at BOTH ends means whichever corner
 * survives still says what kind of thing this is.
 *
 * The root is the exception: its marker stays neutral grey. The subject
 * family's colour is ink, and ink on the round marker would read as emphasis
 * on "1/4" — a number nobody needs emphasised — rather than as a category.
 */
export default function MapCardHeader({
  kind,
  round,
  totalRounds,
  isRoot,
}: {
  kind: string;
  /** Which round this card belongs to, and how many there are — the `2/4`
   *  marker the reference puts in the corner. */
  round: number;
  totalRounds: number;
  isRoot: boolean;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <span
        className="text-[12px] font-bold tabular-nums text-muted"
        style={isRoot ? undefined : { color: familyLineVar(kind) }}
      >
        {round}/{totalRounds}
      </span>
      <CardIcon kind={kind} />
    </header>
  );
}
