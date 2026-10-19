import { SPEEDS } from '../../core/clip';
import { changeClipSpeed } from '../../core/project';
import type { MediaClip } from '../../core/types';
import { createId } from '../../store/createId';
import { getProject, useProjectStore } from '../../store/projectStore';
import { notify } from '../../ui/notify';
import { Segmented } from '../../ui/controls';

const label = (speed: number) => `${String(speed).replace('.', ',')}x`;

/** Vitesse d'un clip vidéo ou audio : 0,5x / 1x / 1,5x / 2x. */
export function SpeedPanel({ clip }: { clip: MediaClip }) {
  return (
    <Segmented
      label="Vitesse"
      value={String(clip.speed)}
      options={SPEEDS.map((s) => ({ value: String(s), label: label(s) }))}
      onChange={(value) => {
        if (Number(value) === clip.speed) return;
        const current = getProject();
        const next = changeClipSpeed(current, clip.id, Number(value), createId());
        if (next === current) {
          notify('Pas assez de place après ce clip pour le ralentir : déplacez le clip suivant ou activez l’aimant.');
          return;
        }
        useProjectStore.getState().commit(() => next);
      }}
    />
  );
}

export { label as speedLabel };
