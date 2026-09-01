import IdeaHero from './IdeaHero';
import IdeaPrompt from './IdeaPrompt';
import SavedMapList from './SavedMapList';
import type { SavedMap } from './SavedMapRow';

/** The whole landing surface: the question, the input, and anything saved. */
export default function LandingScreen({ maps }: { maps: SavedMap[] }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center pb-24">
      <IdeaHero />
      <IdeaPrompt />
      <SavedMapList maps={maps} />
    </div>
  );
}
