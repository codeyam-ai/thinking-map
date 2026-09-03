/**
 * A list of short claims in the far-end column.
 *
 * Takes strings rather than nodes, because both regions that use it are
 * MIXTURES: what is being learned is the map's `known` nodes plus the
 * partner's `finding`s, and what is still open is its `unknown`s plus the
 * `gap`s. Where a line came from is not something the reader needs to sort
 * out, so the component does not carry the distinction either.
 */
import BoardWhereNextEmpty from './BoardWhereNextEmpty';

export default function BoardWhereNextBullets({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((text) => (
        <li
          key={text}
          className="flex gap-2.5 break-words text-[13.5px] leading-snug text-white/80"
        >
          <span aria-hidden="true" className="shrink-0 text-white/40">
            ◆
          </span>
          <span>{text}</span>
        </li>
      ))}
      {items.length === 0 ? <BoardWhereNextEmpty /> : null}
    </ul>
  );
}
