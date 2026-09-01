import { cardEyebrow, type CardEyebrowFacts } from '../lib/cardEyebrow';

/**
 * The line above a card's title, naming what the card is.
 *
 * Presentational only — which words go in the line is `cardEyebrow`'s business,
 * because that is string logic with a rule worth testing ("an answered question
 * must stop saying Open") rather than anything about rendering.
 */
export default function MapCardEyebrow(facts: CardEyebrowFacts) {
  return <span className="eyebrow mb-1.5 block">{cardEyebrow(facts)}</span>;
}
