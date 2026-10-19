import { SPEEDS } from '../../core/clip';
import { changeClipSpeed } from '../../core/project';
import type { MediaClip } from '../../core/types';
import { createId } from '../../store/createId';
import { useProjectStore } from '../../store/projectStore';
import { Segmented } from '../../ui/controls';

const label = (speed: number) => `${String(speed).replace('.', ',')}x`;

/** Vitesse d'un clip vidéo ou audio : 0,5x / 1x / 1,5x / 2x. */
export function SpeedPanel({ clip }: { clip: MediaClip }) {
  return (
    <Segmented
      label="Vitesse"
      value={String(clip.speed)}
      options={SPEEDS.map((s) => ({ value: String(s), label: label(s) }))}
      onChange={(value) => useProjectStore.getState().commit((project) => changeClipSpeed(project, clip.id, Number(value), createId()))}
    />
  );
}

export { label as speedLabel };
