import { sectionLabel } from '../lib/briefFormat';

/**
 * The affordance on a brief section nobody has accounted for.
 *
 * Its whole job is to turn a noticed absence into something the agent will act
 * on, so the visible label and the accessible name deliberately differ. The
 * label is the section MARK: a heading can run to a full sentence, and "Ask
 * about Northgate Library — Digital Membership Renewal" wrapped to three lines
 * in a 276px panel, which is how this ended up split out. The accessible name
 * keeps the heading, where length costs nothing and "§4" alone would tell a
 * screen-reader user nothing about what they are asking after.
 */
export default function AskAboutSectionButton({
  sectionId,
  heading,
  onClick,
}: {
  sectionId: string;
  heading: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ask the agent about section ${sectionId}: ${heading}`}
      className="mt-2 rounded-full border-[1.5px] border-ink px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink"
    >
      Ask about {sectionLabel(sectionId)}
    </button>
  );
}
