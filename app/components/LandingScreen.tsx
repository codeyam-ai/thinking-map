import IdeaHero from './IdeaHero';
import IdeaPrompt from './IdeaPrompt';
import SavedMapList from './SavedMapList';
import type { SavedMap } from './SavedMapRow';

/** The whole landing surface: the question, the input, and anything saved. */
export default function LandingScreen({ maps }: { maps: SavedMap[] }) {
  return (
    // Anchored to the top where height is scarce, centred where it is not:
    // centring plus pb-24 on a half screen left the hero floating with the
    // saved maps pressed toward the bottom.
    <div className="flex flex-1 flex-col items-center justify-start pt-8 pb-10 lg:justify-center lg:pt-0 lg:pb-24">
      <IdeaHero />
      <IdeaPrompt />
      <SavedMapList maps={maps} />
    </div>
  );
}
